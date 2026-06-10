<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('production_history', function (Blueprint $table) {
            $table->id();
            $table->foreignId('production_order_id')->nullable()->constrained('production_orders')->nullOnDelete();
            $table->string('work_order');
            $table->string('line_id');
            $table->string('customer')->nullable();
            $table->string('style')->nullable();
            $table->string('color')->nullable();
            $table->integer('order_qty')->default(0);
            $table->integer('total_line_produced')->default(0);
            $table->integer('total_pac_produced')->default(0);
            $table->json('hourly_data_line')->nullable();
            $table->json('hourly_data_pac')->nullable();
            $table->string('closed_by')->nullable();
            $table->integer('target_per_hour')->default(0);
            $table->timestamps();
        });
    }
    public function down(): void {
        Schema::dropIfExists('production_history');
    }
};