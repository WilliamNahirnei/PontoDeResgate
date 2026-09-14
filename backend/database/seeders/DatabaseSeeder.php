<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        User::factory()->adminMaster()->create([
            'name' => 'Admin Master',
            'email' => 'admin@pontoderesgate.local',
            'password' => 'password',
        ]);
    }
}
