<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::table('production_orders', function (Blueprint $table) {
            $table->string('wo_status')->default('WAITING_CUTTING')->after('is_active');
            $table->string('fg_verified_by')->nullable()->after('wo_status');
            $table->timestamp('fg_verified_at')->nullable()->after('fg_verified_by');
            $table->integer('cutting_total')->default(0)->after('fg_verified_at');
            $table->text('cutting_overqty_remarks')->nullable()->after('cutting_total');
        });
    }
    public function down(): void {
        Schema::table('production_orders', function (Blueprint $table) {
            $table->dropColumn(['wo_status', 'fg_verified_by', 'fg_verified_at', 'cutting_total', 'cutting_overqty_remarks']);
        });
    }
};