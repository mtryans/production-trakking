<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MaterialLog extends Model
{
    protected $guarded = [];
    protected $touches = ['production_order'];

    public function production_order() {
        return $this->belongsTo(ProductionOrder::class);
    }
}