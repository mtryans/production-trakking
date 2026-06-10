<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('best_employee_images', function (Blueprint $table) {
            $table->id();
            $table->longText('image_data');
            $table->string('type')->default('image');
            $table->string('building')->default('HB1');
            $table->string('month')->nullable();
            $table->timestamps();
        });
    }
    public function down(): void {
        Schema::dropIfExists('best_employee_images');
    }
};