<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\TrackerController;
use App\Http\Controllers\Api\HourlyController;
use App\Http\Controllers\Api\MaterialController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\BestEmployeeController;

// --- AUTH ---
Route::post('/login', [UserController::class, 'login']);

// --- PRODUCTION ORDERS ---
Route::get('/tracker', [TrackerController::class, 'index']);
Route::post('/tracker', [TrackerController::class, 'store']);
Route::put('/tracker/{id}', [TrackerController::class, 'update']);
Route::delete('/tracker/{id}', [TrackerController::class, 'destroy']);
Route::post('/tracker/{id}/close-day', [TrackerController::class, 'closeDay']);
Route::post('/tracker/{id}/restore', [TrackerController::class, 'restore']);

// --- HISTORY & TRASH ---
Route::get('/history', [TrackerController::class, 'history']);
Route::get('/trash', [TrackerController::class, 'trash']);
Route::delete('/trash/{id}', [TrackerController::class, 'permanentDelete']);
Route::delete('/trash', [TrackerController::class, 'emptyTrash']);

// --- LOGS ---
Route::get('/logs', [TrackerController::class, 'logs']);

// --- HOURLY OUTPUT ---
Route::post('/hourly', [HourlyController::class, 'update']);

// --- MATERIAL ---
Route::post('/material/cutting', [MaterialController::class, 'addCutting']);
Route::post('/material/prep', [MaterialController::class, 'addPrep']);
Route::post('/material/prep-transfer', [MaterialController::class, 'prepTransfer']);
Route::post('/material/spm-send', [MaterialController::class, 'spmSend']);
Route::post('/material/sewing-schedule', [MaterialController::class, 'updateSewingSchedule']);
Route::post('/material/line-reject', [MaterialController::class, 'lineReject']);
Route::post('/material/forward-reject', [MaterialController::class, 'forwardReject']);
Route::post('/material/process-recut', [MaterialController::class, 'processRecut']);

// --- USERS ---
Route::get('/users', [UserController::class, 'index']);
Route::post('/users', [UserController::class, 'store']);
Route::delete('/users/{id}', [UserController::class, 'destroy']);

// --- BEST EMPLOYEE ---
Route::get('/best-employees', [BestEmployeeController::class, 'index']);
Route::post('/best-employees', [BestEmployeeController::class, 'store']);
Route::post('/best-employees/bulk', [BestEmployeeController::class, 'bulkStore']);
Route::put('/best-employees/{id}', [BestEmployeeController::class, 'update']);
Route::delete('/best-employees/{id}', [BestEmployeeController::class, 'destroy']);

// --- BEST EMPLOYEE IMAGES ---
Route::get('/best-employee-images', [BestEmployeeController::class, 'images']);
Route::post('/best-employee-images', [BestEmployeeController::class, 'storeImage']);
Route::delete('/best-employee-images/{id}', [BestEmployeeController::class, 'destroyImage']);