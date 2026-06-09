<?php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\HourlyOutput;
use App\Models\ProductionOrder;
use App\Events\HourlyUpdated;
use Illuminate\Http\Request;

class HourlyController extends Controller
{
    // POST /api/hourly
    public function update(Request $request)
    {
        $order = ProductionOrder::findOrFail($request->id);

        $hourly = HourlyOutput::updateOrCreate(
            [
                'production_order_id' => $order->id,
                'type'                => $request->type, // 'line' atau 'pac'
                'hour_slot'           => $request->slot,
            ],
            [
                'actual_output'       => $request->value,
                'updated_time_string' => now()->format('H:i'),
            ]
        );

        broadcast(new HourlyUpdated([
            'id'    => $order->id,
            'type'  => $request->type,
            'slot'  => $request->slot,
            'value' => $request->value,
        ]))->toOthers();

        return response()->json(['success' => true]);
    }
}