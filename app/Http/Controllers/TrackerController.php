<?php

namespace App\Http\Controllers;

use App\Models\ProductionOrder;
use App\Models\HourlyOutput;
use App\Models\Finding;
use App\Models\MaterialLog;
use App\Models\Line;
use Illuminate\Http\Request;
use Carbon\Carbon;

class TrackerController extends Controller
{
    // 1. GET DATA DASHBOARD
    public function index(Request $request)
    {
        $date = $request->input('date', Carbon::today()->toDateString());
        
        $orders = ProductionOrder::with([
                    'hourly_outputs' => function($q) { $q->orderBy('id', 'asc'); }, 
                    'findings', 
                    'line',
                    // Kita ambil logs, nanti frontend yang filter mana CUTTING/PREP/SPM
                    'material_logs' => function($q) { $q->orderBy('created_at', 'desc'); }
                ])
                ->whereDate('production_date', $date)
                ->orderBy('id', 'desc')
                ->get();

        return response()->json([
            'date' => $date,
            'orders' => $orders
        ]);
    }

    // 2. INIT DATA (Buat Data Dummy)
    public function initData()
    {
        $today = Carbon::today();
        $exists = ProductionOrder::whereDate('production_date', $today)->exists();
        
        if(!$exists) {
            if(Line::count() == 0) {
                Line::insert([
                    ['name' => 'LINE SEWING A'],
                    ['name' => 'LINE SEWING B'],
                    ['name' => 'LINE PREP 01']
                ]);
            }

            $line = Line::first(); 
            
            $order = ProductionOrder::create([
                'production_date' => $today,
                'line_id' => $line->id,
                'work_order' => 'WO-2026-TEST-' . rand(100,999),
                'style' => 'BACKPACK PRO X',
                'color' => 'BLACK MATTE',
                'target_qty' => 500
            ]);

            $hours = ['08:00', '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00'];
            foreach($hours as $h) {
                $order->hourly_outputs()->create(['hour_slot' => $h, 'actual_output' => 0]);
            }
        }
        return response()->json(['message' => 'Data initialized successfully']);
    }

    // 3. ADMIN: UPDATE OUTPUT JAM-JAMAN
    public function updateHourly(Request $request)
    {
        $hourly = HourlyOutput::find($request->id);
        if($hourly) {
            $hourly->update(['actual_output' => $request->value]);
        }
        return response()->json($hourly);
    }

    // 4. ADMIN/SUPPLY: INPUT MATERIAL MASUK (UPDATED)
    // Di sini kita pastikan CUTTING, PREPARATION, dan SPM tercover
    public function storeMaterial(Request $request)
    {
        // Validasi agar nama proses konsisten
        $request->validate([
            'production_order_id' => 'required|exists:production_orders,id',
            'process_step' => 'required|in:CUTTING,PREPARATION,SPM', // HANYA BOLEH 3 INI
            'qty_in' => 'required|integer|min:1',
        ]);

        $log = MaterialLog::create([
            'production_order_id' => $request->production_order_id,
            'process_step' => $request->process_step,
            'qty_in' => $request->qty_in,
            'qty_reject' => $request->qty_reject ?? 0,
            'notes' => $request->notes
        ]);

        return response()->json($log);
    }

    // 5. AUDITOR: FLAG ISSUE
    public function storeFinding(Request $request)
    {
        $finding = Finding::create([
            'production_order_id' => $request->production_order_id,
            'auditor_name' => 'Guest Auditor',
            'problem' => $request->problem,
            'severity' => $request->severity
        ]);

        ProductionOrder::where('id', $request->production_order_id)->update(['has_issues' => true]);

        return response()->json($finding);
    }

    // 6. AUDITOR: RESOLVE TEMUAN
    public function resolveFinding($id)
    {
        Finding::where('id', $id)->update(['is_resolved' => true]);
        return response()->json(['message' => 'Resolved']);
    }
}