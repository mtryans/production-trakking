<?php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ProductionOrder;
use App\Models\Line;
use App\Models\ActivityLog;
use App\Events\ProductionUpdated;
use Illuminate\Http\Request;

class TrackerController extends Controller
{
    // GET /api/tracker - ambil semua data
    public function index()
    {
        $orders = ProductionOrder::with(['line', 'hourlyOutputs', 'materialLogs', 'lineRejects', 'recutRequests'])
            ->where('is_active', true)
            ->get()
            ->map(function ($order) {
                // Hitung total line & pac hari ini
                $hourlyLine = $order->hourlyOutputs->where('type', 'line')->keyBy('hour_slot');
                $hourlyPac  = $order->hourlyOutputs->where('type', 'pac')->keyBy('hour_slot');

                $hourlyDataLine = [];
                $hourlyDataPac  = [];
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

                // Material logs cutting history
                $cuttingHistory = $order->materialLogs
                    ->where('action', 'cutting')
                    ->map(fn($l) => [
                        'date'      => $l->created_at->format('d/n'),
                        'qty'       => $l->qty,
                        'user'      => $l->user,
                        'timestamp' => $l->created_at->timestamp * 1000,
                        'isRecut'   => $l->is_recut,
                    ])->values();

                // Line rejects
                $lineRejects = $order->lineRejects->map(fn($r) => [
                    'id'       => $r->id,
                    'qty'      => $r->qty,
                    'destPrep' => $r->dest_prep,
                    'remarks'  => $r->remarks,
                    'status'   => $r->status,
                    'date'     => $r->created_at->format('d/m/Y H:i'),
                ])->values();

                // Recut requests
                $recutRequests = $order->recutRequests->map(fn($r) => [
                    'id'           => $r->id,
                    'from'         => $r->from_prep,
                    'isLineReject' => $r->is_line_reject,
                    'qty'          => $r->qty,
                    'remarks'      => $r->remarks,
                    'status'       => $r->status,
                    'date'         => $r->created_at->format('d/m/Y H:i'),
                ])->values();

                return [
                    'id'               => $order->id,
                    'lineId'           => $order->line->name ?? '',
                    'customer'         => $order->customer,
                    'sitoyPo'          => $order->sitoy_po,
                    'workOrder'        => $order->work_order,
                    'style'            => $order->style,
                    'color'            => $order->color,
                    'image'            => $order->image_path,
                    'orderQty'         => $order->order_qty,
                    'finishQty'        => $order->finish_qty,
                    'targetDay'        => $order->target_day,
                    'targetPerHour'    => $order->target_per_hour,
                    'startDate'        => $order->start_date?->format('Y-m-d'),
                    'endDate'          => $order->end_date?->format('Y-m-d'),
                    'exFlyDate'        => $order->ex_fly_date?->format('Y-m-d'),
                    'sampleApproval'   => $order->sample_approval,
                    'lineWorkers'      => $order->line_workers,
                    'headName'         => $order->head_name,
                    'remarks'          => $order->remarks,
                    'hourlyDataLine'   => $hourlyDataLine,
                    'hourlyDataPac'    => $hourlyDataPac,
                    'hourlyUpdatesLine'=> $hourlyUpdatesLine,
                    'hourlyUpdatesPac' => $hourlyUpdatesPac,
                    'calcTotalLine'    => $calcTotalLine,
                    'calcTotalPac'     => $calcTotalPac,
                    'materialData'     => [
                        'cuttingHistory' => $cuttingHistory,
                        'prep'           => [
                            'bonding'  => $order->prep_bonding,
                            'skiving'  => $order->prep_skiving,
                            'lining'   => $order->prep_lining,
                            'painting' => $order->prep_painting,
                            'gluing'   => $order->prep_gluing,
                        ],
                        'supermarket'    => $order->supermarket_stock,
                        'scrapTotal'     => $order->scrap_total,
                        'lineRejects'    => $lineRejects,
                        'recutRequests'  => $recutRequests,
                    ],
                    'sewingMaterialSchedule' => [
                        'takenFromSPM'  => $order->taken_from_spm,
                        'takenFromPrep' => $order->taken_from_prep,
                        'remarks'       => $order->sewing_remarks,
                    ],
                    'createdAt' => ['seconds' => $order->created_at->timestamp],
                    'updatedAt' => ['seconds' => $order->updated_at->timestamp],
                ];
            });

        return response()->json($orders);
    }

    // POST /api/tracker - buat WO baru
    public function store(Request $request)
    {
        $line = Line::where('name', $request->lineId)->first();

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
            'start_date'      => $request->startDate,
            'end_date'        => $request->endDate,
            'ex_fly_date'     => $request->exFlyDate,
            'sample_approval' => $request->sampleApproval,
            'line_workers'    => $request->lineWorkers ?? 0,
            'head_name'       => $request->headName,
            'remarks'         => $request->remarks,
            'is_active'       => true,
        ]);

        $this->logActivity('INPUT BARU', "New WO {$request->workOrder}", $request->workOrder, $request->lineId, $request->user);
        broadcast(new ProductionUpdated(['action' => 'created', 'id' => $order->id]))->toOthers();

        return response()->json(['success' => true, 'id' => $order->id]);
    }

    // PUT /api/tracker/{id} - update WO
    public function update(Request $request, $id)
    {
        $order = ProductionOrder::findOrFail($id);
        $line  = Line::where('name', $request->lineId)->first();

        $order->update([
            'line_id'         => $line->id,
            'customer'        => $request->customer,
            'sitoy_po'        => $request->sitoyPo,
            'work_order'      => $request->workOrder,
            'style'           => $request->style,
            'color'           => $request->color,
            'image_path'      => $request->image ?? $order->image_path,
            'order_qty'       => $request->orderQty ?? 0,
            'finish_qty'      => $request->finishQty ?? 0,
            'target_day'      => $request->targetDay ?? 0,
            'target_per_hour' => $request->targetPerHour ?? 0,
            'start_date'      => $request->startDate,
            'end_date'        => $request->endDate,
            'ex_fly_date'     => $request->exFlyDate,
            'sample_approval' => $request->sampleApproval,
            'line_workers'    => $request->lineWorkers ?? 0,
            'head_name'       => $request->headName,
            'remarks'         => $request->remarks,
        ]);

        $this->logActivity('EDIT DATA', "Edit WO {$request->workOrder}", $request->workOrder, $request->lineId, $request->user);
        broadcast(new ProductionUpdated(['action' => 'updated', 'id' => $order->id]))->toOthers();

        return response()->json(['success' => true]);
    }

    // DELETE /api/tracker/{id}
    public function destroy(Request $request, $id)
    {
        $order = ProductionOrder::findOrFail($id);
        $order->update(['is_active' => false]);

        $this->logActivity('HAPUS DATA', "Hapus WO {$order->work_order}", $order->work_order, $order->line->name ?? '', $request->user);
        broadcast(new ProductionUpdated(['action' => 'deleted', 'id' => $id]))->toOthers();

        return response()->json(['success' => true]);
    }

    // POST /api/tracker/{id}/close-day
    public function closeDay(Request $request, $id)
    {
        $order = ProductionOrder::with('hourlyOutputs')->findOrFail($id);

        $totalLine = $order->hourlyOutputs->where('type', 'line')->sum('actual_output');
        $newFinish = $order->finish_qty + $totalLine;

        $order->update([
            'finish_qty' => $newFinish,
        ]);

        // Reset hourly outputs
        $order->hourlyOutputs()->delete();

        $this->logActivity('TUTUP HARI', "LINE: {$totalLine}. FinishQty: {$newFinish}", $order->work_order, $order->line->name ?? '', $request->user);
        broadcast(new ProductionUpdated(['action' => 'day_closed', 'id' => $id]))->toOthers();

        return response()->json(['success' => true, 'newFinishQty' => $newFinish]);
    }

    private function logActivity($action, $details, $workOrder, $lineId, $user = null)
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