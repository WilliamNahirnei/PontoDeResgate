<?php

namespace Modules\Resgates\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Modules\Resgates\Database\Factories\RescueRequestFactory;
use Modules\Resgates\Enums\RescueRequestStatus;
use Modules\Usuarios\Models\User;

#[Fillable([
    'latitude',
    'longitude',
    'requester_name',
    'total_people',
    'men_count',
    'women_count',
    'children_count',
    'elderly_count',
    'animals_count',
    'reference_point',
    'status',
    'cancellation_reason',
    'operator_id',
])]
class RescueRequest extends Model
{
    /** @use HasFactory<RescueRequestFactory> */
    use HasFactory, SoftDeletes;

    /**
     * Resolve the factory used to build instances of this model in tests/seeders.
     */
    protected static function newFactory(): RescueRequestFactory
    {
        return RescueRequestFactory::new();
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'latitude' => 'decimal:7',
            'longitude' => 'decimal:7',
            'status' => RescueRequestStatus::class,
        ];
    }

    /**
     * The operator currently assigned to this rescue request, if any.
     *
     * @return BelongsTo<User, $this>
     */
    public function operator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'operator_id');
    }

    /**
     * The full history of status changes for this rescue request.
     *
     * @return HasMany<RescueStatusLog, $this>
     */
    public function statusLogs(): HasMany
    {
        return $this->hasMany(RescueStatusLog::class);
    }
}
