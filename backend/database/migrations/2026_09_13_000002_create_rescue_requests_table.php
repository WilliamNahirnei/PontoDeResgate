<?php

use App\Enums\RescueRequestStatus;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('rescue_requests', function (Blueprint $table) {
            $table->id();

            $table->decimal('latitude', 10, 7);
            $table->decimal('longitude', 10, 7);

            $table->string('requester_name')->nullable();
            $table->unsignedInteger('total_people')->nullable();
            $table->unsignedInteger('men_count')->nullable();
            $table->unsignedInteger('women_count')->nullable();
            $table->unsignedInteger('children_count')->nullable();
            $table->unsignedInteger('elderly_count')->nullable();
            $table->unsignedInteger('animals_count')->nullable();
            $table->text('reference_point')->nullable();

            $table->string('status')->default(RescueRequestStatus::Pendente->value);
            $table->text('cancellation_reason')->nullable();
            $table->foreignId('operator_id')->nullable()->constrained('users')->nullOnDelete();

            $table->timestamps();
            $table->softDeletes();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('rescue_requests');
    }
};
