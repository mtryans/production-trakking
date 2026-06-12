<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;

class ProductionOrder extends Model
{
    protected $guarded = [];

    protected $casts = [
        'start_date'   => 'date',
        'end_date'     => 'date',
        'ex_fly_date'  => 'date',
        'is_active'    => 'boolean',
        'fg_verified_at' => 'datetime',
    ];

    public function line() {
        return $this->belongsTo(Line::class);
    }

    public function hourlyOutputs() {
        return $this->hasMany(HourlyOutput::class);
    }

    public function materialLogs() {
        return $this->hasMany(MaterialLog::class);
    }

    public function lineRejects() {
        return $this->hasMany(LineReject::class);
    }

    public function recutRequests() {
        return $this->hasMany(RecutRequest::class);
    }

    public function activityLogs() {
        return $this->hasMany(ActivityLog::class, 'work_order', 'work_order');
    }

    // Helper: total output hari ini (LINE)
    public function getTotalLineAttribute()
{
    return $this->hourlyOutputs()
        ->where('type', 'LINE')
        ->sum('actual_output');
}

public function getTotalPacAttribute()
{
    return $this->hourlyOutputs()
        ->where('type', 'PAC')
        ->sum('actual_output');
}
public function woStatusLogs() {
        return $this->hasMany(WoStatusLog::class, 'work_order', 'work_order');
    }

    public function lineAssignments() {
        return $this->hasMany(WoLineAssignment::class, 'work_order', 'work_order');
    }
}