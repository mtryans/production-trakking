<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('best_employees', function (Blueprint $table) {
            $table->id();
            $table->string('emp_id')->nullable();
            $table->string('name');
            $table->string('dept')->nullable();
            $table->string('position')->nullable();
            $table->string('position_cn')->nullable();
            $table->integer('attendance')->default(0);
            $table->integer('performance')->default(0);
            $table->text('photo')->nullable();
            $table->string('month')->nullable();
            $table->string('building')->default('HB1');
            $table->timestamps();
        });
    }
    public function down(): void {
        Schema::dropIfExists('best_employees');
    }
};