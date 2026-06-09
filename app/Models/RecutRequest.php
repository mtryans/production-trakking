<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;

class RecutRequest extends Model
{
    protected $guarded = [];

    public function productionOrder() {
        return $this->belongsTo(ProductionOrder::class);
    }
}