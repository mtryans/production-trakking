<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;

class Line extends Model
{
    protected $guarded = [];

    public function productionOrders() {
        return $this->hasMany(ProductionOrder::class);
    }
}