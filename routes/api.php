<?php
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\TrackerController;
use App\Http\Controllers\Api\HourlyController;
use App\Http\Controllers\Api\MaterialController;

Route::get('/tracker', [TrackerController::class, 'index']);
Route::post('/tracker', [TrackerController::class, 'store']);
Route::put('/tracker/{id}', [TrackerController::class, 'update']);
Route::delete('/tracker/{id}', [TrackerController::class, 'destroy']);
Route::post('/tracker/{id}/close-day', [TrackerController::class, 'closeDay']);

Route::post('/hourly', [HourlyController::class, 'update']);

Route::post('/material/cutting', [MaterialController::class, 'addCutting']);
Route::post('/material/prep', [MaterialController::class, 'addPrep']);
Route::post('/material/spm-send', [MaterialController::class, 'spmSend']);