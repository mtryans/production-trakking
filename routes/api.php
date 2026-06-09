<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\TrackerController;
// Jika nantinya kamu membuat AuthController:
// use App\Http\Controllers\AuthController;

// --- RUTE PUBLIK / TAMU ---
Route::get('/tracker/public', [TrackerController::class, 'index']);

// --- RUTE TERSANDANG (AUTH) ---
Route::middleware('auth:sanctum')->group(function () {
    
    Route::get('/user', function (Request $request) {
        return $request->user();
    });

    // --- API PRODUCTION TRACKER ---
    
    // Dashboard & Init
    Route::get('/tracker', [TrackerController::class, 'index']);
    Route::post('/tracker/init', [TrackerController::class, 'initData']); // Penting untuk seeder pertama kali
    
    // Hourly Updates
    Route::post('/tracker/hourly', [TrackerController::class, 'updateHourly']);
    
    // Material Control
    Route::post('/tracker/material', [TrackerController::class, 'storeMaterial']);
    
    // Audit & Findings
    Route::post('/tracker/finding', [TrackerController::class, 'storeFinding']);
    Route::post('/tracker/resolve/{id}', [TrackerController::class, 'resolveFinding']);

    // --- FITUR TAMBAHAN (Sesuai kode React lamamu) ---
    // Tambahkan ini jika kamu ingin mengaktifkan fitur Trash/History di backend
    // Route::post('/tracker/delete/{id}', [TrackerController::class, 'destroy']); 
    // Route::post('/tracker/restore/{id}', [TrackerController::class, 'restore']);
    // Route::delete('/tracker/trash/empty', [TrackerController::class, 'emptyTrash']);
});