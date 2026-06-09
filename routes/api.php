<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\TrackerController;

Route::middleware('auth:sanctum')->get('/user', function (Request $request) {
    return $request->user();
});

// --- API PRODUCTION TRACKER ---
Route::get('/tracker', [TrackerController::class, 'index']);           // Ambil Data Dashboard
Route::post('/tracker/init', [TrackerController::class, 'initData']);  // Generate Data Dummy
Route::post('/tracker/hourly', [TrackerController::class, 'updateHourly']); // Update Jam
Route::post('/tracker/material', [TrackerController::class, 'storeMaterial']); // Input Material
Route::post('/tracker/finding', [TrackerController::class, 'storeFinding']);   // Buat Temuan Audit
Route::post('/tracker/resolve/{id}', [TrackerController::class, 'resolveFinding']); // Selesaikan Masalah