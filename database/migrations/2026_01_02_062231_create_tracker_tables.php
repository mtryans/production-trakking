<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up()
    {
        // 1. Tabel Master Line
        Schema::create('lines', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique(); 
            $table->string('building')->default('HB1'); // Menampung filter HB1/HB2
            $table->timestamps();
        });

        // 2. Tabel Utama: ORDER PRODUKSI (Pusat Relasi WO)
        Schema::create('production_orders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('line_id')->constrained('lines');
            
            // Info WO Master
            $table->string('customer')->nullable();
            $table->string('sitoy_po')->nullable();
            $table->string('work_order')->unique()->index(); // Relasi konseptual WO
            $table->string('style')->nullable();
            $table->string('color')->nullable();
            $table->string('image_path')->nullable(); // Simpan path URL, bukan Base64
            
            // Qty & Target
            $table->integer('order_qty')->default(0);
            $table->integer('finish_qty')->default(0);
            $table->integer('target_day')->default(0);
            $table->integer('target_per_hour')->default(0);
            
            // Tanggal (Bisa Null karena di awal mungkin kosong)
            $table->date('start_date')->nullable();
            $table->date('end_date')->nullable();
            $table->date('ex_fly_date')->nullable();
            $table->string('sample_approval')->nullable();
            
            // Manpower
            $table->integer('line_workers')->default(0);
            $table->string('head_name')->nullable();
            $table->text('remarks')->nullable();

            // Material Stock (State Utama dari Prep & SPM)
            $table->integer('prep_bonding')->default(0);
            $table->integer('prep_skiving')->default(0);
            $table->integer('prep_lining')->default(0);
            $table->integer('prep_painting')->default(0);
            $table->integer('prep_gluing')->default(0);
            $table->integer('supermarket_stock')->default(0);
            $table->integer('scrap_total')->default(0);
            
            // Sewing Material Schedule (Berapa yang sudah diambil Line)
            $table->integer('taken_from_spm')->default(0);
            $table->integer('taken_from_prep')->default(0);
            $table->text('sewing_remarks')->nullable();

            $table->boolean('is_active')->default(true); // Ganti status text
            $table->timestamps();
        });

        // 3. Tabel JAM-JAMAN (Menggantikan hourlyDataLine & hourlyDataPac)
        Schema::create('hourly_outputs', function (Blueprint $table) {
            $table->id();
            // WO sebagai Relasi (Jika WO dihapus, data jam-jaman ikut terhapus)
            $table->foreignId('production_order_id')->constrained()->cascadeOnDelete();
            
            $table->enum('type', ['LINE', 'PAC']); // Membedakan Line Output & Packing Output
            $table->string('hour_slot'); // "1", "2", "3" ... "10"
            $table->integer('actual_output')->default(0);
            $table->string('updated_time_string')->nullable(); // Untuk menyimpan teks jam update misal "14:30"
            
            $table->timestamps();
            
            // Pastikan 1 WO hanya punya 1 kombinasi Tipe dan Jam
            $table->unique(['production_order_id', 'type', 'hour_slot']);
        });

        // 4. Tabel LOG MATERIAL (Menggantikan array cuttingHistory dll)
        Schema::create('material_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('production_order_id')->constrained()->cascadeOnDelete();
            
            $table->string('process_step'); // CUTTING, PREP_BONDING, dll
            $table->string('action'); // ADD_ACTUAL, TRANSFER, SPMSEND
            $table->integer('qty'); 
            $table->boolean('is_recut')->default(false); // Flag khusus hasil recut cutting
            $table->string('user')->nullable(); // Siapa yang input
            $table->text('notes')->nullable();
            
            $table->timestamps();
        });

        // 5. Tabel REJECT DARI LINE (Menggantikan lineRejects array)
        Schema::create('line_rejects', function (Blueprint $table) {
            $table->id();
            $table->foreignId('production_order_id')->constrained()->cascadeOnDelete();
            
            $table->integer('qty');
            $table->string('dest_prep'); // Kembalikan ke bonding, skiving, dll
            $table->text('remarks');
            $table->string('status')->default('PENDING'); // PENDING, FORWARDED_TO_CUTTING
            
            $table->timestamps();
        });

        // 6. Tabel RECUT REQUEST (Menggantikan recutRequests array)
        Schema::create('recut_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('production_order_id')->constrained()->cascadeOnDelete();
            
            $table->string('from_prep'); // Asal request dari bagian prep mana
            $table->boolean('is_line_reject')->default(false);
            $table->integer('qty');
            $table->text('remarks');
            $table->string('status')->default('PENDING'); // PENDING, DONE
            $table->integer('recut_done')->default(0);
            $table->integer('scrap_done')->default(0);
            
            $table->timestamps();
        });

        // 7. Tabel ACTIVITY LOGS
        Schema::create('activity_logs', function (Blueprint $table) {
            $table->id();
            $table->string('work_order')->index();
            $table->string('line_id')->nullable();
            $table->string('action');
            $table->text('details');
            $table->string('user_id'); // Bisa di-link ke foreign key user jika mau
            $table->timestamps();
        });

        // SEEDER AWAL (Disesuaikan dengan format array LINES 1-12)
        $lines = [];
        for($i=1; $i<=12; $i++) {
            $lines[] = ['name' => 'HB1-'.str_pad($i, 2, '0', STR_PAD_LEFT), 'building' => 'HB1'];
            $lines[] = ['name' => 'HB2-'.str_pad($i, 2, '0', STR_PAD_LEFT), 'building' => 'HB2'];
        }
        DB::table('lines')->insert($lines);
    }

    public function down()
    {
        // Drop dengan urutan terbalik dari Up untuk menghindari error Foreign Key
        Schema::dropIfExists('activity_logs');
        Schema::dropIfExists('recut_requests');
        Schema::dropIfExists('line_rejects');
        Schema::dropIfExists('material_logs');
        Schema::dropIfExists('hourly_outputs');
        Schema::dropIfExists('production_orders');
        Schema::dropIfExists('lines');
    }
};