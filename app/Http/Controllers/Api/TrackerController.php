<?php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ProductionOrder;
use App\Models\ProductionHistory;
use App\Models\ProductionTrash;
use App\Models\ActivityLog;
use App\Models\Line;
use App\Events\ProductionUpdated;
use Illuminate\Http\Request;

class TrackerController extends Controller
{
    private function formatOrder($order)
    {
        $hourlyLine = $order->hourlyOutputs->where('type', 'line')->keyBy('hour_slot');
        $hourlyPac  = $order->hourlyOutputs->where('type', 'pac')->keyBy('hour_slot');

        $hourlyDataLine    = [];
        $hourlyDataPac     = [];
        $hourlyUpdatesLine = [];
        $hourlyUpdatesPac  = [];

        foreach ($hourlyLine as $slot => $h) {
            $hourlyDataLine[$slot]    = $h->actual_output;
            $hourlyUpdatesLine[$slot] = $h->updated_time_string;
        }
        foreach ($hourlyPac as $slot => $h) {
            $hourlyDataPac[$slot]    = $h->actual_output;
            $hourlyUpdatesPac[$slot] = $h->updated_time_string;
        }

        $calcTotalLine = array_sum($hourlyDataLine);
        $calcTotalPac  = array_sum($hourlyDataPac);

        $cuttingHistory = $order->materialLogs
            ->where('action', 'cutting')
            ->map(fn($l) => [
                'date'      => $l->created_at->format('d/n'),
                'qty'       => $l->qty,
                'user'      => $l->user,
                'timestamp' => $l->created_at->timestamp * 1000,
                'isRecut'   => (bool) $l->is_recut,
            ])->values();

        $lineRejects = $order->lineRejects->map(fn($r) => [
            'id'       => $r->id,
            'qty'      => $r->qty,
            'destPrep' => $r->dest_prep,
            'remarks'  => $r->remarks,
            'status'   => $r->status,
            'date'     => $r->created_at->format('d/m/Y H:i'),
        ])->values();

        $recutRequests = $order->recutRequests->map(fn($r) => [
            'id'           => $r->id,
            'from'         => $r->from_prep,
            'isLineReject' => (bool) $r->is_line_reject,
            'qty'          => $r->qty,
            'remarks'      => $r->remarks,
            'status'       => $r->status,
            'date'         => $r->created_at->format('d/m/Y H:i'),
        ])->values();

        return [
            'id'                => $order->id,
            'lineId'            => $order->line->name ?? '',
            'customer'          => $order->customer ?? '',
            'sitoyPo'           => $order->sitoy_po ?? '',
            'workOrder'         => $order->work_order ?? '',
            'style'             => $order->style ?? '',
            'color'             => $order->color ?? '',
            'image'             => $order->image_path ?? '',
            'orderQty'          => $order->order_qty ?? 0,
            'finishQty'         => $order->finish_qty ?? 0,
            'targetDay'         => $order->target_day ?? 0,
            'targetPerHour'     => $order->target_per_hour ?? 0,
            'startDate'         => $order->start_date?->format('Y-m-d'),
            'endDate'           => $order->end_date?->format('Y-m-d'),
            'exFlyDate'         => $order->ex_fly_date?->format('Y-m-d'),
            'sampleApproval'    => $order->sample_approval ?? '',
            'lineWorkers'       => $order->line_workers ?? 0,
            'headName'          => $order->head_name ?? '',
            'remarks'           => $order->remarks ?? '',
            'hourlyDataLine'    => $hourlyDataLine,
            'hourlyDataPac'     => $hourlyDataPac,
            'hourlyUpdatesLine' => $hourlyUpdatesLine,
            'hourlyUpdatesPac'  => $hourlyUpdatesPac,
            'calcTotalLine'     => $calcTotalLine,
            'calcTotalPac'      => $calcTotalPac,
            'materialData'      => [
                'cuttingHistory' => $cuttingHistory,
                'prep'           => [
                    'bonding'  => $order->prep_bonding ?? 0,
                    'skiving'  => $order->prep_skiving ?? 0,
                    'lining'   => $order->prep_lining ?? 0,
                    'painting' => $order->prep_painting ?? 0,
                    'gluing'   => $order->prep_gluing ?? 0,
                ],
                'supermarket'    => $order->supermarket_stock ?? 0,
                'scrapTotal'     => $order->scrap_total ?? 0,
                'lineRejects'    => $lineRejects,
                'recutRequests'  => $recutRequests,
            ],
            'sewingMaterialSchedule' => [
                'takenFromSPM'  => $order->taken_from_spm ?? 0,
                'takenFromPrep' => $order->taken_from_prep ?? 0,
                'remarks'       => $order->sewing_remarks ?? '',
            ],
            'createdAt' => ['seconds' => $order->created_at->timestamp],
            'updatedAt' => ['seconds' => $order->updated_at->timestamp],
        ];
    }

    public function index()
    {
        $orders = ProductionOrder::with([
            'line', 'hourlyOutputs', 'materialLogs',
            'lineRejects', 'recutRequests'
        ])
        ->where('is_active', true)
        ->get()
        ->map(fn($o) => $this->formatOrder($o))
        ->sortBy('lineId')
        ->values();

        return response()->json($orders);
    }

    public function store(Request $request)
    {
        $line = Line::where('name', $request->lineId)->first();
        if (!$line) return response()->json(['error' => 'Line tidak ditemukan'], 404);

        $order = ProductionOrder::create([
            'line_id'         => $line->id,
            'customer'        => $request->customer,
            'sitoy_po'        => $request->sitoyPo,
            'work_order'      => $request->workOrder,
            'style'           => $request->style,
            'color'           => $request->color,
            'image_path'      => $request->image,
            'order_qty'       => $request->orderQty ?? 0,
            'finish_qty'      => $request->finishQty ?? 0,
            'target_day'      => $request->targetDay ?? 0,
            'target_per_hour' => $request->targetPerHour ?? 0,
            'start_date'      => $request->startDate ?: null,
            'end_date'        => $request->endDate ?: null,
            'ex_fly_date'     => $request->exFlyDate ?: null,
            'sample_approval' => $request->sampleApproval,
            'line_workers'    => $request->lineWorkers ?? 0,
            'head_name'       => $request->headName,
            'remarks'         => $request->remarks,
            'is_active'       => true,
        ]);

        $this->log('INPUT BARU', "New WO {$request->workOrder}", $request->workOrder, $request->lineId, $request->user);
        broadcast(new ProductionUpdated(['action' => 'created', 'id' => $order->id]))->toOthers();

        return response()->json(['success' => true, 'id' => $order->id]);
    }

    public function update(Request $request, $id)
    {
        $order = ProductionOrder::findOrFail($id);
        $line  = Line::where('name', $request->lineId)->first();

        $order->update([
            'line_id'         => $line->id ?? $order->line_id,
            'customer'        => $request->customer,
            'sitoy_po'        => $request->sitoyPo,
            'work_order'      => $request->workOrder,
            'style'           => $request->style,
            'color'           => $request->color,
            'image_path'      => $request->image ?? $order->image_path,
            'order_qty'       => $request->orderQty ?? 0,
            'finish_qty'      => $request->finishQty ?? 0,
            'target_day'      => $request->targetDay ?? 0,
            'target_per_hour' => $request->targetPerHour ?? $order->target_per_hour,
            'start_date'      => $request->startDate ?: null,
            'end_date'        => $request->endDate ?: null,
            'ex_fly_date'     => $request->exFlyDate ?: null,
            'sample_approval' => $request->sampleApproval,
            'line_workers'    => $request->lineWorkers ?? 0,
            'head_name'       => $request->headName,
            'remarks'         => $request->remarks,
        ]);

        $this->log('EDIT DATA', "Edit WO {$request->workOrder}", $request->workOrder, $request->lineId, $request->user);
        broadcast(new ProductionUpdated(['action' => 'updated', 'id' => $order->id]))->toOthers();

        return response()->json(['success' => true]);
    }

    public function destroy(Request $request, $id)
    {
        $order = ProductionOrder::with('line')->findOrFail($id);

        ProductionTrash::create([
            'work_order'    => $order->work_order,
            'line_id'       => $order->line->name ?? '',
            'style'         => $order->style,
            'customer'      => $order->customer,
            'deleted_by'    => $request->user ?? 'Unknown',
            'original_data' => json_encode($order->toArray()),
            'expire_at'     => now()->addDays(7),
        ]);

        $order->update(['is_active' => false]);

        $this->log('HAPUS DATA', "Pindah ke Trash WO {$order->work_order}", $order->work_order, $order->line->name ?? '', $request->user);
        broadcast(new ProductionUpdated(['action' => 'deleted', 'id' => $id]))->toOthers();

        return response()->json(['success' => true]);
    }

    public function restore(Request $request, $id)
    {
        $trash = ProductionTrash::findOrFail($id);
        $order = ProductionOrder::where('work_order', $trash->work_order)->first();

        if ($order) {
            $order->update(['is_active' => true]);
        }

        $trash->delete();

        $this->log('RESTORE DATA', "Restore WO {$trash->work_order}", $trash->work_order, $trash->line_id, $request->user);
        broadcast(new ProductionUpdated(['action' => 'restored']))->toOthers();

        return response()->json(['success' => true]);
    }

    public function closeDay(Request $request, $id)
    {
        $order = ProductionOrder::with(['hourlyOutputs', 'line'])->findOrFail($id);

        $totalLine = $order->hourlyOutputs->where('type', 'line')->sum('actual_output');
        $totalPac  = $order->hourlyOutputs->where('type', 'pac')->sum('actual_output');

        $hourlyDataLine = [];
        $hourlyDataPac  = [];
        foreach ($order->hourlyOutputs->where('type', 'line') as $h) {
            $hourlyDataLine[$h->hour_slot] = $h->actual_output;
        }
        foreach ($order->hourlyOutputs->where('type', 'pac') as $h) {
            $hourlyDataPac[$h->hour_slot] = $h->actual_output;
        }

        ProductionHistory::create([
            'production_order_id' => $order->id,
            'work_order'          => $order->work_order,
            'line_id'             => $order->line->name ?? '',
            'customer'            => $order->customer,
            'style'               => $order->style,
            'color'               => $order->color,
            'order_qty'           => $order->order_qty,
            'total_line_produced' => $totalLine,
            'total_pac_produced'  => $totalPac,
            'hourly_data_line'    => json_encode($hourlyDataLine),
            'hourly_data_pac'     => json_encode($hourlyDataPac),
            'closed_by'           => $request->user ?? 'Unknown',
            'target_per_hour'     => $order->target_per_hour,
        ]);

        $newFinish = $order->finish_qty + $totalLine;
        $order->update(['finish_qty' => $newFinish]);
        $order->hourlyOutputs()->delete();

        $this->log('TUTUP HARI', "LINE: {$totalLine}, PAC: {$totalPac}. FinishQty: {$newFinish}", $order->work_order, $order->line->name ?? '', $request->user);
        broadcast(new ProductionUpdated(['action' => 'day_closed', 'id' => $id]))->toOthers();

        return response()->json(['success' => true, 'newFinishQty' => $newFinish, 'totalLine' => $totalLine, 'totalPac' => $totalPac]);
    }

    public function history()
    {
        $history = ProductionHistory::orderBy('created_at', 'desc')->get()->map(fn($h) => [
            'id'               => $h->id,
            'workOrder'        => $h->work_order,
            'lineId'           => $h->line_id,
            'customer'         => $h->customer,
            'style'            => $h->style,
            'color'            => $h->color,
            'orderQty'         => $h->order_qty,
            'totalLineProduced' => $h->total_line_produced,
            'totalPacProduced'  => $h->total_pac_produced,
            'hourlyDataLine'   => json_decode($h->hourly_data_line, true) ?? [],
            'hourlyDataPac'    => json_decode($h->hourly_data_pac, true) ?? [],
            'closedBy'         => $h->closed_by,
            'targetPerHour'    => $h->target_per_hour,
            'timestamp'        => ['seconds' => $h->created_at->timestamp],
            'date'             => $h->created_at->format('d/m/Y'),
        ]);

        return response()->json($history);
    }

    public function trash()
    {
        $trash = ProductionTrash::orderBy('created_at', 'desc')->get()->map(fn($t) => [
            'id'        => $t->id,
            'workOrder' => $t->work_order,
            'lineId'    => $t->line_id,
            'style'     => $t->style,
            'customer'  => $t->customer,
            'deletedBy' => $t->deleted_by,
            'deletedAt' => ['seconds' => $t->created_at->timestamp],
            'expireAt'  => $t->expire_at,
        ]);

        return response()->json($trash);
    }

    public function permanentDelete(Request $request, $id)
    {
        $trash = ProductionTrash::findOrFail($id);
        $wo    = $trash->work_order;
        $trash->delete();

        $this->log('HAPUS PERMANEN', "Hapus permanen WO {$wo}", $wo, '-', $request->user);

        return response()->json(['success' => true]);
    }

    public function emptyTrash(Request $request)
    {
        $count = ProductionTrash::count();
        ProductionTrash::truncate();

        $this->log('EMPTY TRASH', "Mengosongkan {$count} data dari trash", '-', '-', $request->user);

        return response()->json(['success' => true]);
    }

    public function logs()
    {
        $logs = ActivityLog::orderBy('created_at', 'desc')->take(50)->get()->map(fn($l) => [
            'id'        => $l->id,
            'action'    => $l->action,
            'details'   => $l->details,
            'workOrder' => $l->work_order,
            'lineId'    => $l->line_id,
            'userId'    => $l->user_id,
            'timestamp' => ['seconds' => $l->created_at->timestamp],
        ]);

        return response()->json($logs);
    }

    private function log($action, $details, $workOrder, $lineId, $user = null)
    {
        ActivityLog::create([
            'action'     => $action,
            'details'    => $details,
            'work_order' => $workOrder ?? '-',
            'line_id'    => $lineId ?? '-',
            'user_id'    => $user ?? 'System',
        ]);
    }
}