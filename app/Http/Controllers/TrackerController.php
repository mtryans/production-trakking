<?php

namespace App\Http\Controllers;

use App\Models\ProductionOrder;
use App\Models\HourlyOutput;
use App\Models\Finding;
use App\Models\MaterialLog;
use App\Models\Line;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Carbon\Carbon;

class TrackerController extends Controller
{
    /**
     * Helper untuk memicu Realtime Update di React via Firebase
     */
    private function notifyFrontend()
    {
        $projectId = env('VITE_FIREBASE_PROJECT_ID');
        try {
            Http::patch(
                "https://firestore.googleapis.com/v1/projects/{$projectId}/databases/(default)/documents/system_sync/production_updates",
                ['fields' => ['last_updated' => ['integerValue' => time()]]]
            );
        } catch (\Exception $e) {
            \Log::error("Firebase Sync Error: " . $e->getMessage());
        }
    }

    // 1. GET DATA DASHBOARD
    public function index(Request $request)
    {
        $date = $request->input('date', Carbon::today()->toDateString());
        
        $orders = ProductionOrder::with([
                    'hourly_outputs', 
                    'findings', 
                    'line',
                    'material_logs'
                ])
                ->whereDate('production_date', $date)
                ->orderBy('id', 'desc')
                ->get();

        return response()->json([
            'date' => $date,
            'orders' => $orders
        ]);
    }

    // 2. ADMIN: UPDATE OUTPUT JAM-JAMAN
    public function updateHourly(Request $request)
    {
        $validated = $request->validate([
            'id' => 'required|exists:hourly_outputs,id',
            'value' => 'required|integer'
        ]);

        $hourly = HourlyOutput::findOrFail($request->id);
        $hourly->update(['actual_output' => $request->value]);

        $this->notifyFrontend(); // Sinyal ke React
        return response()->json($hourly);
    }

    // 3. ADMIN/SUPPLY: INPUT MATERIAL MASUK (CUTTING, PREP, SPM)
    public function storeMaterial(Request $request)
    {
        $request->validate([
            'production_order_id' => 'required|exists:production_orders,id',
            'process_step' => 'required|in:CUTTING,PREPARATION,SPM',
            'qty_in' => 'required|integer|min:0',
            'qty_reject' => 'nullable|integer|min:0',
        ]);

        $log = MaterialLog::create([
            'production_order_id' => $request->production_order_id,
            'process_step' => $request->process_step,
            'qty' => $request->qty_in,
            'action' => 'ADD_ACTUAL',
            'user' => $request->user()->name ?? 'System',
            'notes' => $request->notes
        ]);

        // Update stok di tabel order agar cepat di-load di dashboard
        $order = ProductionOrder::find($request->production_order_id);
        if($request->process_step == 'SPM') {
            $order->increment('supermarket_stock', $request->qty_in);
        }

        $this->notifyFrontend(); // Sinyal ke React
        return response()->json($log);
    }

    // 4. AUDITOR: FLAG ISSUE
    public function storeFinding(Request $request)
    {
        $validated = $request->validate([
            'production_order_id' => 'required|exists:production_orders,id',
            'problem' => 'required',
            'severity' => 'required|in:LOW,MEDIUM,HIGH'
        ]);

        $finding = Finding::create($validated);
        ProductionOrder::where('id', $request->production_order_id)->update(['has_issues' => true]);

        $this->notifyFrontend();
        return response()->json($finding);
    }

    // 5. AUDITOR: RESOLVE TEMUAN
    public function resolveFinding($id)
    {
        $finding = Finding::findOrFail($id);
        $finding->update(['is_resolved' => true]);

        // Cek apakah masih ada temuan yang belum resolved untuk WO ini
        $unresolved = Finding::where('production_order_id', $finding->production_order_id)
                             ->where('is_resolved', false)
                             ->count();
        
        if($unresolved === 0) {
            ProductionOrder::where('id', $finding->production_order_id)->update(['has_issues' => false]);
        }

        $this->notifyFrontend();
        return response()->json(['message' => 'Resolved']);
    }
}