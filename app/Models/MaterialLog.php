<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;

class MaterialLog extends Model
{
    protected $guarded = [];
    protected $touches = ['productionOrder'];

    public function productionOrder() {
        return $this->belongsTo(ProductionOrder::class);
    }
}