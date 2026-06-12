<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('wo_status_logs', function (Blueprint $table) {
            $table->id();
            $table->string('work_order');
            $table->string('status'); 
            // WAITING_CUTTING, IN_CUTTING, IN_PREP, IN_SEWING, 
            // ONGOING_FG, DONE_TO_STOCK, DONE_TO_SHIPPING, DONE
            $table->string('changed_by')->nullable();
            $table->text('remarks')->nullable();
            $table->timestamps();
        });
    }
    public function down(): void {
        Schema::dropIfExists('wo_status_logs');
    }
};