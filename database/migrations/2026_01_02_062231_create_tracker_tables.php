<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up()
    {
        // 1. Tabel Master Line (Contoh: Line Sewing A, Prep B)
        Schema::create('lines', function (Blueprint $table) {
            $table->id();
            $table->string('name'); 
            $table->timestamps();
        });

        // 2. Tabel Utama: ORDER PRODUKSI (WO)
        Schema::create('production_orders', function (Blueprint $table) {
            $table->id();
            $table->date('production_date')->index(); // Tanggal Produksi
            $table->foreignId('line_id')->constrained('lines'); // Relasi ke Line
            $table->string('work_order'); // Nomor WO
            $table->string('style');      // Nama Style/Model
            $table->string('color');      // Warna
            $table->integer('target_qty'); 
            $table->string('status')->default('RUNNING'); // Status WO
            $table->boolean('has_issues')->default(false); // Flag Merah (jika ada temuan audit)
            $table->timestamps();
        });

        // 3. Tabel JAM-JAMAN (Hourly Output Tracker)
        Schema::create('hourly_outputs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('production_order_id')->constrained()->onDelete('cascade');
            $table->string('hour_slot'); // Contoh: "08:00", "09:00"
            $table->integer('actual_output')->default(0); // Diisi Admin Produksi
            $table->timestamps();
        });

        // 4. Tabel LOG MATERIAL (Barang Masuk / Supply Chain)
        // Mencatat supply dari Cutting -> Prep -> Supermarket
        Schema::create('material_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('production_order_id')->constrained()->onDelete('cascade');
            
            // Kolom ini akan diisi: 'CUTTING', 'PREPARATION', atau 'SPM'
            $table->string('process_step'); 
            
            $table->integer('qty_in')->default(0); // Jumlah Masuk
            $table->integer('qty_reject')->default(0); // Jumlah Reject
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        // 5. Tabel TEMUAN AUDIT (Audit Findings)
        Schema::create('findings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('production_order_id')->constrained()->onDelete('cascade');
            $table->string('auditor_name')->default('Guest Auditor'); 
            $table->text('problem'); // Masalahnya apa
            $table->enum('severity', ['LOW', 'MEDIUM', 'HIGH']); // Tingkat Keparahan
            $table->boolean('is_resolved')->default(false); // Sudah beres belum
            $table->text('admin_response')->nullable(); // Jawaban Produksi
            $table->timestamps();
        });

        // SEEDER: Isi data awal Line agar tidak kosong saat pertama kali run
        DB::table('lines')->insert([
            ['name' => 'LINE SEWING A'],
            ['name' => 'LINE SEWING B'],
            ['name' => 'LINE PREP 01']
        ]);
    }

    public function down()
    {
        Schema::dropIfExists('findings');
        Schema::dropIfExists('material_logs');
        Schema::dropIfExists('hourly_outputs');
        Schema::dropIfExists('production_orders');
        Schema::dropIfExists('lines');
    }
};