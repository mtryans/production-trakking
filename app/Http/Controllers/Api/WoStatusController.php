<?php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ProductionOrder;
use App\Models\WoStatusLog;
use App\Models\WoLineAssignment;
use App\Models\ProductionHistory;
use App\Events\ProductionUpdated;
use Illuminate\Http\Request;

class WoStatusController extends Controller
{
    // GET /api/wo-status — list semua WO dengan statusnya
    public function index(Request $request)
    {
        $search = $request->search ?? '';

        $orders = ProductionOrder::with([
            'line', 'hourlyOutputs', 'materialLogs', 
            'lineAssignments', 'woStatusLogs'
        ])
        ->when($search, function ($q) use ($search) {
            $q->where('work_order', 'like', "%{$search}%")
              ->orWhere('style', 'like', "%{$search}%")
              ->orWhere('customer', 'like', "%{$search}%");
        })
        ->orderBy('created_at', 'desc')
        ->get()
        ->map(fn($o) => $this->formatWoStatus($o));

        return response()->json($orders);
    }

    // GET /api/wo-status/{workOrder}/detail
    public function detail($workOrder)
    {
        $orders = ProductionOrder::with([
            'line', 'hourlyOutputs', 'materialLogs',
            'lineAssignments', 'woStatusLogs'
        ])
        ->where('work_order', $workOrder)
        ->get();

        if ($orders->isEmpty()) {
            return response()->json(['error' => 'WO tidak ditemukan'], 404);
        }

        $first = $orders->first();

        // Hitung akumulasi dari semua history + active
        $histories = ProductionHistory::where('work_order', $workOrder)->get();
        
        $totalLineAcc = $histories->sum('total_line_produced');
        $totalPacAcc  = $histories->sum('total_pac_produced');
        $totalCutting = $first->cutting_total ?? 0;

        // Tambah output hari ini yang belum di-close
        foreach ($orders as $order) {
            $totalLineAcc += $order->hourlyOutputs->where('type', 'line')->sum('actual_output');
            $totalPacAcc  += $order->hourlyOutputs->where('type', 'pac')->sum('actual_output');
        }

        // Per line detail
        $lineDetails = $orders->map(function ($order) use ($histories) {
            $lineHistories = $histories->where('line_id', $order->line->name ?? '');
            $lineTotal = $lineHistories->sum('total_line_produced') 
                + $order->hourlyOutputs->where('type', 'line')->sum('actual_output');
            $pacTotal = $lineHistories->sum('total_pac_produced')
                + $order->hourlyOutputs->where('type', 'pac')->sum('actual_output');

            // Audit jam 1-7
            $auditIssues = [];
            $allHistory = $lineHistories->toArray();
            foreach ($allHistory as $h) {
                $hourlyData = json_decode($h['hourly_data_line'], true) ?? [];
                for ($i = 1; $i <= 7; $i++) {
                    if (empty($hourlyData[strval($i)])) {
                        $auditIssues[] = "Tgl {$h['created_at']} J{$i} kosong";
                    }
                }
            }

            // Cek hari ini
            $todayHourly = $order->hourlyOutputs->where('type', 'line')->keyBy('hour_slot');
            $maxSlot = $todayHourly->keys()->max() ?? 0;
            if ($maxSlot >= 1 && $order->hourlyOutputs->where('type', 'line')->sum('actual_output') > 0) {
                for ($i = 1; $i <= min($maxSlot, 7); $i++) {
                    if (!isset($todayHourly[strval($i)])) {
                        $auditIssues[] = "Hari ini J{$i} kosong";
                    }
                }
            }

            return [
                'lineId'       => $order->line->name ?? '',
                'totalLine'    => $lineTotal,
                'totalPac'     => $pacTotal,
                'finishQty'    => $order->finish_qty,
                'auditIssues'  => $auditIssues,
                'woStatus'     => $order->wo_status,
            ];
        })->values();

        // Status log
        $statusLogs = WoStatusLog::where('work_order', $workOrder)
            ->orderBy('created_at', 'desc')
            ->get()
            ->map(fn($l) => [
                'status'    => $l->status,
                'changedBy' => $l->changed_by,
                'remarks'   => $l->remarks,
                'timestamp' => $l->created_at->format('d/m/Y H:i'),
            ]);

        return response()->json([
            'workOrder'    => $workOrder,
            'customer'     => $first->customer,
            'style'        => $first->style,
            'color'        => $first->color,
            'orderQty'     => $first->order_qty,
            'woStatus'     => $first->wo_status,
            'totalCutting' => $totalCutting,
            'totalLine'    => $totalLineAcc,
            'totalPac'     => $totalPacAcc,
            'lineDetails'  => $lineDetails,
            'statusLogs'   => $statusLogs,
            'fgVerifiedBy' => $first->fg_verified_by,
            'fgVerifiedAt' => $first->fg_verified_at?->format('d/m/Y H:i'),
        ]);
    }

    // POST /api/wo-status/{workOrder}/change-status
    public function changeStatus(Request $request, $workOrder)
    {
        $canChange = in_array($request->userRole, ['ADMINISTRATOR', 'FINISH_GOOD']);
        
        $allowedTransitions = [
            'WAITING_CUTTING'   => ['IN_CUTTING'],
            'IN_CUTTING'        => ['IN_PREP'],
            'IN_PREP'           => ['IN_SEWING'],
            'IN_SEWING'         => ['ONGOING_FG'],
            'ONGOING_FG'        => ['DONE_TO_STOCK', 'DONE_TO_SHIPPING'],
            'DONE_TO_STOCK'     => ['DONE_TO_SHIPPING', 'DONE'],
            'DONE_TO_SHIPPING'  => ['DONE_TO_STOCK', 'DONE'],
        ];

        $orders = ProductionOrder::where('work_order', $workOrder)->get();
        if ($orders->isEmpty()) return response()->json(['error' => 'WO tidak ditemukan'], 404);

        $currentStatus = $orders->first()->wo_status;
        $newStatus = $request->status;

        // Validasi transisi
        if (!isset($allowedTransitions[$currentStatus]) || 
            !in_array($newStatus, $allowedTransitions[$currentStatus])) {
            return response()->json(['error' => "Tidak bisa pindah dari {$currentStatus} ke {$newStatus}"], 422);
        }

        // Hanya FINISH_GOOD/ADMIN yang bisa ubah status FG
        $fgStatuses = ['ONGOING_FG', 'DONE_TO_STOCK', 'DONE_TO_SHIPPING', 'DONE'];
        if (in_array($newStatus, $fgStatuses) && !$canChange) {
            return response()->json(['error' => 'Tidak punya akses untuk mengubah status ini'], 403);
        }

        // Update semua order dengan WO yang sama
        foreach ($orders as $order) {
            $updateData = ['wo_status' => $newStatus];

            if ($newStatus === 'DONE') {
                $updateData['is_active'] = false;
                $updateData['fg_verified_by'] = $request->user;
                $updateData['fg_verified_at'] = now();
            }

            if (in_array($newStatus, ['DONE_TO_STOCK', 'DONE_TO_SHIPPING'])) {
                $updateData['fg_verified_by'] = $request->user;
                $updateData['fg_verified_at'] = now();
            }

            $order->update($updateData);
        }

        // Log status change
        WoStatusLog::create([
            'work_order' => $workOrder,
            'status'     => $newStatus,
            'changed_by' => $request->user ?? 'Unknown',
            'remarks'    => $request->remarks,
        ]);

        broadcast(new ProductionUpdated(['action' => 'status_changed', 'workOrder' => $workOrder]))->toOthers();

        return response()->json(['success' => true, 'newStatus' => $newStatus]);
    }

    // POST /api/wo-status/{workOrder}/split
    public function splitLine(Request $request, $workOrder)
    {
        $order = ProductionOrder::where('work_order', $workOrder)
            ->where('is_active', true)
            ->first();

        if (!$order) return response()->json(['error' => 'WO tidak ditemukan'], 404);

        // Catat assignment
        WoLineAssignment::firstOrCreate(
            ['work_order' => $workOrder, 'line_id' => $order->line->name ?? ''],
            ['production_order_id' => $order->id, 'type' => 'PRIMARY', 'status' => 'ACTIVE']
        );

        WoLineAssignment::create([
            'work_order'          => $workOrder,
            'production_order_id' => $order->id,
            'line_id'             => $request->newLineId,
            'type'                => 'SPLIT',
            'target_qty'          => $request->targetQty ?? 0,
            'status'              => 'ACTIVE',
            'remarks'             => $request->remarks,
        ]);

        WoStatusLog::create([
            'work_order' => $workOrder,
            'status'     => 'SPLIT_TO_' . $request->newLineId,
            'changed_by' => $request->user ?? 'Unknown',
            'remarks'    => "Split ke {$request->newLineId}, target: {$request->targetQty} pcs",
        ]);

        broadcast(new ProductionUpdated(['action' => 'split', 'workOrder' => $workOrder]))->toOthers();

        return response()->json(['success' => true]);
    }

    // POST /api/wo-status/{workOrder}/transfer
    public function transferLine(Request $request, $workOrder)
    {
        $order = ProductionOrder::where('work_order', $workOrder)
            ->where('is_active', true)
            ->first();

        if (!$order) return response()->json(['error' => 'WO tidak ditemukan'], 404);

        $oldLine = $order->line->name ?? '';
        $newLine = $request->newLineId;

        // Update line assignment lama jadi TRANSFERRED
        WoLineAssignment::where('work_order', $workOrder)
            ->where('line_id', $oldLine)
            ->where('status', 'ACTIVE')
            ->update(['status' => 'TRANSFERRED']);

        // Catat assignment baru
        WoLineAssignment::create([
            'work_order'          => $workOrder,
            'production_order_id' => $order->id,
            'line_id'             => $newLine,
            'type'                => 'TRANSFER',
            'status'              => 'ACTIVE',
            'remarks'             => $request->remarks,
        ]);

        WoStatusLog::create([
            'work_order' => $workOrder,
            'status'     => 'TRANSFERRED',
            'changed_by' => $request->user ?? 'Unknown',
            'remarks'    => "Transfer dari {$oldLine} ke {$newLine}. Output sebelumnya: {$order->finish_qty} pcs",
        ]);

        broadcast(new ProductionUpdated(['action' => 'transferred', 'workOrder' => $workOrder]))->toOthers();

        return response()->json(['success' => true]);
    }

    private function formatWoStatus($order)
    {
        // Hitung akumulasi dari history
        $histories = ProductionHistory::where('work_order', $order->work_order)->get();
        $totalLineAcc = $histories->sum('total_line_produced')
            + $order->hourlyOutputs->where('type', 'line')->sum('actual_output');
        $totalPacAcc = $histories->sum('total_pac_produced')
            + $order->hourlyOutputs->where('type', 'pac')->sum('actual_output');

        // Audit jam 1-7 hari ini
        $auditIssues = [];
        $todayHourly = $order->hourlyOutputs->where('type', 'line')->keyBy('hour_slot');
        $maxSlot = $todayHourly->keys()->max() ?? 0;
        if ($maxSlot >= 1) {
            for ($i = 1; $i <= min((int)$maxSlot, 7); $i++) {
                if (!$todayHourly->has(strval($i))) {
                    $auditIssues[] = "J{$i}";
                }
            }
        }

        return [
            'id'            => $order->id,
            'workOrder'     => $order->work_order,
            'customer'      => $order->customer ?? '',
            'style'         => $order->style ?? '',
            'color'         => $order->color ?? '',
            'lineId'        => $order->line->name ?? '',
            'orderQty'      => $order->order_qty ?? 0,
            'woStatus'      => $order->wo_status ?? 'WAITING_CUTTING',
            'totalCutting'  => $order->cutting_total ?? 0,
            'totalLine'     => $totalLineAcc,
            'totalPac'      => $totalPacAcc,
            'auditIssues'   => $auditIssues,
            'fgVerifiedBy'  => $order->fg_verified_by,
            'fgVerifiedAt'  => $order->fg_verified_at?->format('d/m/Y H:i'),
            'createdAt'     => ['seconds' => $order->created_at->timestamp],
            'lineAssignments' => $order->lineAssignments->map(fn($a) => [
                'lineId'    => $a->line_id,
                'type'      => $a->type,
                'targetQty' => $a->target_qty,
                'status'    => $a->status,
            ])->values(),
        ];
    }
}