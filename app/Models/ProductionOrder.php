<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ProductionOrder extends Model
{
    // Mengizinkan mass assignment untuk semua kolom (agar bisa create/update pakai array)
    protected $guarded = [];

    /**
     * Relasi ke Master Line
     * Setiap WO dikerjakan di satu Line tertentu.
     */
    public function line() {
        return $this->belongsTo(Line::class);
    }

    /**
     * Relasi ke Output Jam-jaman (Hourly Outputs)
     * Satu WO memiliki banyak slot jam (08:00, 09:00, dst).
     */
    public function hourly_outputs() {
        return $this->hasMany(HourlyOutput::class);
    }

    /**
     * Relasi ke Log Material (Supply Chain)
     * Satu WO bisa memiliki banyak catatan material masuk (Cutting/Prep/SPM).
     */
    public function material_logs() {
        return $this->hasMany(MaterialLog::class);
    }

    /**
     * Relasi ke Temuan Audit (Findings)
     * Satu WO bisa memiliki banyak temuan masalah dari Auditor.
     */
    public function findings() {
        return $this->hasMany(Finding::class);
    }
}