<?php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BestEmployee;
use App\Models\BestEmployeeImage;
use Illuminate\Http\Request;

class BestEmployeeController extends Controller
{
    public function index()
    {
        return response()->json(
            BestEmployee::orderBy('performance', 'desc')->get()
        );
    }

    public function store(Request $request)
    {
        $emp = BestEmployee::create([
            'emp_id'      => $request->empId,
            'name'        => $request->name,
            'dept'        => $request->dept,
            'position'    => $request->position,
            'position_cn' => $request->positionCn,
            'attendance'  => $request->attendance ?? 0,
            'performance' => $request->performance ?? 0,
            'photo'       => $request->photo,
            'month'       => $request->month,
            'building'    => $request->building ?? 'HB1',
        ]);

        return response()->json(['success' => true, 'id' => $emp->id]);
    }

    public function bulkStore(Request $request)
    {
        $employees = $request->employees ?? [];
        foreach ($employees as $emp) {
            BestEmployee::create([
                'emp_id'      => $emp['empId'] ?? '',
                'name'        => $emp['name'] ?? '',
                'dept'        => $emp['dept'] ?? '',
                'position'    => $emp['position'] ?? '',
                'position_cn' => $emp['positionCn'] ?? '',
                'attendance'  => $emp['attendance'] ?? 0,
                'performance' => $emp['performance'] ?? 0,
                'photo'       => '',
                'month'       => $emp['month'] ?? '',
                'building'    => $emp['building'] ?? 'HB1',
            ]);
        }

        return response()->json(['success' => true, 'count' => count($employees)]);
    }

    public function update(Request $request, $id)
    {
        $emp = BestEmployee::findOrFail($id);
        $emp->update([
            'emp_id'      => $request->empId,
            'name'        => $request->name,
            'dept'        => $request->dept,
            'position'    => $request->position,
            'position_cn' => $request->positionCn,
            'attendance'  => $request->attendance ?? 0,
            'performance' => $request->performance ?? 0,
            'photo'       => $request->photo ?? $emp->photo,
            'month'       => $request->month,
            'building'    => $request->building ?? 'HB1',
        ]);

        return response()->json(['success' => true]);
    }

    public function destroy($id)
    {
        BestEmployee::findOrFail($id)->delete();
        return response()->json(['success' => true]);
    }

    public function images()
    {
        return response()->json(
            BestEmployeeImage::orderBy('created_at', 'desc')->get()->map(fn($i) => [
                'id'        => $i->id,
                'imageData' => $i->image_data,
                'type'      => $i->type,
                'building'  => $i->building,
                'month'     => $i->month,
                'createdAt' => ['seconds' => $i->created_at->timestamp],
            ])
        );
    }

    public function storeImage(Request $request)
    {
        $img = BestEmployeeImage::create([
            'image_data' => $request->imageData,
            'type'       => $request->type ?? 'image',
            'building'   => $request->building ?? 'HB1',
            'month'      => $request->month ?? '',
        ]);

        return response()->json(['success' => true, 'id' => $img->id]);
    }

    public function destroyImage($id)
    {
        BestEmployeeImage::findOrFail($id)->delete();
        return response()->json(['success' => true]);
    }
}