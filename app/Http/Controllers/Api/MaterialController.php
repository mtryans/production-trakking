<?php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ProductionOrder;
use App\Models\MaterialLog;
use App\Models\LineReject;
use App\Models\RecutRequest;
use App\Events\ProductionUpdated;
use Illuminate\Http\Request;

class MaterialController extends Controller
{
    public function addCutting(Request $request)
{
    $order = ProductionOrder::findOrFail($request->id);
    $qty = intval($request->qty);  // ← fix: pakai intval
    $qty = intval($request->qty);
    
    $currentTotal = $order->cutting_total ?? 0;
    $newTotal = $currentTotal + $qty;

    // Lock: tidak boleh > order qty tanpa remarks
    if ($newTotal > $order->order_qty) {
        if (empty($request->remarks)) {
            return response()->json([
                'error' => "Cutting melebihi Order Qty ({$order->order_qty})! Wajib isi remarks.",
                'requireRemarks' => true,
            ], 422);
        }
        // Simpan remarks overqty
        $order->cutting_overqty_remarks = $request->remarks;
    }

    // Update cutting_total
    $order->cutting_total = $newTotal;

    // Auto update wo_status ke IN_CUTTING
    if ($order->wo_status === 'WAITING_CUTTING') {
        $order->wo_status = 'IN_CUTTING';
        \App\Models\WoStatusLog::create([
            'work_order' => $order->work_order,
            'status'     => 'IN_CUTTING',
            'changed_by' => $request->user ?? 'Unknown',
            'remarks'    => 'Cutting mulai diinput',
        ]);
    }

    $order->save();

    MaterialLog::create([
        'production_order_id' => $order->id,
        'process_step'        => 'cutting',
        'action'              => 'cutting',
        'qty'                 => $qty,
        'is_recut'            => false,
        'user'                => $request->user ?? 'Unknown',
        'notes'               => $request->remarks ?? null,
    ]);

    broadcast(new ProductionUpdated(['action' => 'material_updated', 'id' => $order->id]))->toOthers();
    return response()->json(['success' => true, 'newTotal' => $newTotal]);
}

    public function addPrep(Request $request)
{
    $order = ProductionOrder::findOrFail($request->id);
    $qty = intval($request->qty);
    $field = 'prep_' . $request->process;

    // Hitung total semua prep sekarang
    $totalPrep = ($order->prep_bonding ?? 0)
        + ($order->prep_skiving ?? 0)
        + ($order->prep_lining ?? 0)
        + ($order->prep_painting ?? 0)
        + ($order->prep_gluing ?? 0);

    $cuttingTotal = $order->cutting_total ?? 0;

    // Lock: total prep tidak boleh > cutting total
    if (($totalPrep + $qty) > $cuttingTotal) {
        $sisa = $cuttingTotal - $totalPrep;
        return response()->json([
            'error' => "Total prep akan melebihi cutting ({$cuttingTotal})! Sisa yang bisa diinput: {$sisa} pcs.",
        ], 422);
    }

    $order->increment($field, $qty);

    // Auto update wo_status ke IN_PREP
    if ($order->wo_status === 'IN_CUTTING') {
        $order->wo_status = 'IN_PREP';
        $order->save();
        \App\Models\WoStatusLog::create([
            'work_order' => $order->work_order,
            'status'     => 'IN_PREP',
            'changed_by' => $request->user ?? 'Unknown',
            'remarks'    => 'Prep mulai diinput',
        ]);
    }

    MaterialLog::create([
        'production_order_id' => $order->id,
        'process_step'        => $request->process,
        'action'              => 'prep_add',
        'qty'                 => $qty,
        'user'                => $request->user ?? 'Unknown',
    ]);

    broadcast(new ProductionUpdated(['action' => 'material_updated', 'id' => $order->id]))->toOthers();
    return response()->json(['success' => true]);
}

    public function prepTransfer(Request $request)
    {
        $order    = ProductionOrder::findOrFail($request->id);
        $fromProc = $request->fromProcess;
        $dest     = $request->dest;
        $qty      = $request->qty;
        $remarks  = $request->remarks ?? '';

        $fromField = 'prep_' . $fromProc;
        if ($order->$fromField < $qty) {
            return response()->json(['error' => "Stok di {$fromProc} tidak cukup!"], 422);
        }

        $order->decrement($fromField, $qty);

        if ($dest === 'LINE') {
            $order->increment('taken_from_prep', $qty);
            if ($remarks) {
                $order->sewing_remarks = $order->sewing_remarks
                    ? $order->sewing_remarks . ' | ' . $remarks
                    : $remarks;
                $order->save();
            }
        } elseif ($dest === 'SPM') {
            $order->increment('supermarket_stock', $qty);
        } elseif ($dest === 'RECUT') {
            RecutRequest::create([
                'production_order_id' => $order->id,
                'from_prep'           => $fromProc,
                'is_line_reject'      => false,
                'qty'                 => $qty,
                'remarks'             => $remarks,
                'status'              => 'PENDING',
            ]);
        } else {
            // Transfer antar prep
            $toField = 'prep_' . $dest;
            $order->increment($toField, $qty);
        }

        broadcast(new ProductionUpdated(['action' => 'material_updated', 'id' => $order->id]))->toOthers();
        return response()->json(['success' => true]);
    }

    public function spmSend(Request $request)
    {
        $order = ProductionOrder::findOrFail($request->id);

        if ($request->qty > $order->supermarket_stock) {
            return response()->json(['error' => "Stok SPM hanya {$order->supermarket_stock}"], 422);
        }

        $order->decrement('supermarket_stock', $request->qty);
        $order->increment('taken_from_spm', $request->qty);

        broadcast(new ProductionUpdated(['action' => 'material_updated', 'id' => $order->id]))->toOthers();
        return response()->json(['success' => true]);
    }

    public function updateSewingSchedule(Request $request)
    {
        $order = ProductionOrder::findOrFail($request->id);

        $order->update([
            'taken_from_prep' => $request->takenFromPrep ?? $order->taken_from_prep,
            'sewing_remarks'  => $request->remarks ?? $order->sewing_remarks,
        ]);

        broadcast(new ProductionUpdated(['action' => 'material_updated', 'id' => $order->id]))->toOthers();
        return response()->json(['success' => true]);
    }

    public function lineReject(Request $request)
    {
        $order = ProductionOrder::findOrFail($request->id);

        LineReject::create([
            'production_order_id' => $order->id,
            'qty'                 => $request->qty,
            'dest_prep'           => $request->destPrep,
            'remarks'             => $request->remarks,
            'status'              => 'PENDING',
        ]);

        broadcast(new ProductionUpdated(['action' => 'material_updated', 'id' => $order->id]))->toOthers();
        return response()->json(['success' => true]);
    }

    public function forwardReject(Request $request)
    {
        $reject = LineReject::findOrFail($request->rejectId);
        $reject->update(['status' => 'FORWARDED_TO_CUTTING']);

        RecutRequest::create([
            'production_order_id' => $reject->production_order_id,
            'from_prep'           => $reject->dest_prep,
            'is_line_reject'      => true,
            'qty'                 => $reject->qty,
            'remarks'             => '[Reject Line] ' . $reject->remarks,
            'status'              => 'PENDING',
        ]);

        broadcast(new ProductionUpdated(['action' => 'material_updated', 'id' => $reject->production_order_id]))->toOthers();
        return response()->json(['success' => true]);
    }
    
    public function addRepair(Request $request)
{
    $order = ProductionOrder::findOrFail($request->id);

    if (empty($request->remarks)) {
        return response()->json([
            'error' => 'Remarks wajib diisi untuk Repair!',
        ], 422);
    }

    // Repair tidak nambah cutting total maupun scrap
    MaterialLog::create([
        'production_order_id' => $order->id,
        'process_step'        => $request->fromPrep ?? 'cutting',
        'action'              => 'repair',
        'qty'                 => intval($request->qty),
        'is_recut'            => false,
        'user'                => $request->user ?? 'Unknown',
        'notes'               => $request->remarks,
    ]);

    broadcast(new ProductionUpdated(['action' => 'material_updated', 'id' => $order->id]))->toOthers();
    return response()->json(['success' => true]);
}

    public function processRecut(Request $request)
    {
        $recut    = RecutRequest::findOrFail($request->recutId);
        $recutQty = $request->recutQty ?? 0;
        $scrapQty = $request->scrapQty ?? 0;

        if ($recutQty + $scrapQty > $recut->qty) {
            return response()->json(['error' => 'Total melebihi jumlah request!'], 422);
        }

        $recut->update([
            'status'     => 'DONE',
            'recut_done' => $recutQty,
            'scrap_done' => $scrapQty,
        ]);
        
        
        $order = ProductionOrder::findOrFail($recut->production_order_id);
        $order->increment('scrap_total', $scrapQty);

        if ($recutQty > 0) {
            $prepField = 'prep_' . $recut->from_prep;
            $order->increment($prepField, $recutQty);

            MaterialLog::create([
                'production_order_id' => $order->id,
                'process_step'        => 'cutting',
                'action'              => 'cutting',
                'qty'                 => $recutQty,
                'is_recut'            => true,
                'user'                => $request->user ?? 'Unknown',
            ]);
        }

        broadcast(new ProductionUpdated(['action' => 'material_updated', 'id' => $order->id]))->toOthers();
        return response()->json(['success' => true]);
    }
}
