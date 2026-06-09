<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // Cek user agar tidak duplikat
        if (!User::where('email', 'admin@sitoy.com')->exists()) {
            User::create([
                'name' => 'Admin Produksi',
                'email' => 'admin@sitoy.com',
                'password' => Hash::make('password123'), // Passwordnya ini
                // 'role' => 'ADMIN' // Jika sudah tambah kolom role di tabel users
            ]);
        }

        if (!User::where('email', 'muhammad_taufik@sitoy.com')->exists()) {
            User::create([
                'name' => 'Ryansyah',
                'email' => 'muhammad_taufik@sitoy.com',
                'password' => Hash::make('Pass@word1'),
                // 'role' => 'AUDITOR'
            ]);
        }
    }
}