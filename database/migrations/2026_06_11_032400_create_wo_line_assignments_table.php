<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('wo_line_assignments', function (Blueprint $table) {
            $table->id();
            $table->string('work_order');
            $table->foreignId('production_order_id')->constrained('production_orders')->cascadeOnDelete();
            $table->string('line_id'); // nama line e.g. HB1-01
            $table->string('type'); // PRIMARY, SPLIT, TRANSFER
            $table->integer('target_qty')->default(0); // untuk split
            $table->integer('finish_qty_line')->default(0); // akumulasi output line
            $table->integer('finish_qty_pac')->default(0);  // akumulasi output pac
            $table->string('status')->default('ACTIVE'); // ACTIVE, DONE, TRANSFERRED
            $table->text('remarks')->nullable();
            $table->timestamps();
        });
    }
    public function down(): void {
        Schema::dropIfExists('wo_line_assignments');
    }
};