<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('production_trash', function (Blueprint $table) {
            $table->id();
            $table->string('work_order');
            $table->string('line_id');
            $table->string('style')->nullable();
            $table->string('customer')->nullable();
            $table->string('deleted_by')->nullable();
            $table->json('original_data')->nullable();
            $table->timestamp('expire_at')->nullable();
            $table->timestamps();
        });
    }
    public function down(): void {
        Schema::dropIfExists('production_trash');
    }
};