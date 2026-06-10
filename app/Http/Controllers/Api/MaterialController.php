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

        MaterialLog::create([
            'production_order_id' => $order->id,
            'process_step'        => 'cutting',
            'action'              => 'cutting',
            'qty'                 => $request->qty,
            'is_recut'            => false,
            'user'                => $request->user ?? 'Unknown',
        ]);

        broadcast(new ProductionUpdated(['action' => 'material_updated', 'id' => $order->id]))->toOthers();
        return response()->json(['success' => true]);
    }

    public function addPrep(Request $request)
    {
        $order = ProductionOrder::findOrFail($request->id);
        $field = 'prep_' . $request->process;

        $order->increment($field, $request->qty);

        MaterialLog::create([
            'production_order_id' => $order->id,
            'process_step'        => $request->process,
            'action'              => 'prep_add',
            'qty'                 => $request->qty,
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