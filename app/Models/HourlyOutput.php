<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class HourlyOutput extends Model
{
    protected $guarded = [];
    
    // Jika jam-jaman diupdate, timestamp WO induk ikut berubah (biar frontend tahu ada update)
    protected $touches = ['production_order'];

    public function production_order() {
        return $this->belongsTo(ProductionOrder::class);
    }
}