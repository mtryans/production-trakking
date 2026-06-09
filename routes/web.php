<?php

use Illuminate\Support\Facades\Route;

// Gunakan route fallback agar React Router (jika nantinya kamu pakai) 
// bisa menangani navigasi di sisi klien dengan baik.
Route::get('/{any?}', function () {
    return view('welcome');
})->where('any', '.*');