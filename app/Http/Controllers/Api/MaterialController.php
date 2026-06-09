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
    // POST /api/material/cutting
    public function addCutting(Request $request)
    {
        $order = ProductionOrder::findOrFail($request->id);

        MaterialLog::create([
            'production_order_id' => $order->id,
            'process_step'        => 'cutting',
            'action'              => 'cutting',
            'qty'                 => $request->qty,
            'is_recut'            => false,
            'user'                => $request->user,
        ]);

        broadcast(new ProductionUpdated(['action' => 'material_updated', 'id' => $order->id]))->toOthers();
        return response()->json(['success' => true]);
    }

    // POST /api/material/prep
    public function addPrep(Request $request)
    {
        $order = ProductionOrder::findOrFail($request->id);
        $field = 'prep_' . $request->process; // bonding/skiving/lining/painting/gluing

        $order->increment($field, $request->qty);

        MaterialLog::create([
            'production_order_id' => $order->id,
            'process_step'        => $request->process,
            'action'              => 'prep_add',
            'qty'                 => $request->qty,
            'user'                => $request->user,
        ]);

        broadcast(new ProductionUpdated(['action' => 'material_updated', 'id' => $order->id]))->toOthers();
        return response()->json(['success' => true]);
    }

    // POST /api/material/spm-send
    public function spmSend(Request $request)
    {
        $order = ProductionOrder::findOrFail($request->id);

        if ($request->qty > $order->supermarket_stock) {
            return response()->json(['error' => 'Stok SPM tidak cukup'], 422);
        }

        $order->decrement('supermarket_stock', $request->qty);
        $order->increment('taken_from_spm', $request->qty);

        broadcast(new ProductionUpdated(['action' => 'material_updated', 'id' => $order->id]))->toOthers();
        return response()->json(['success' => true]);
    }
}