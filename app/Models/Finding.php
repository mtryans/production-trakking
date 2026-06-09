<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Finding extends Model
{
    protected $guarded = [];
    protected $touches = ['production_order'];
}