<?php

namespace Modules\Resgates\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Resgates\Database\Factories\RescueStatusLogFactory;
use Modules\Resgates\Enums\RescueRequestStatus;
use Modules\Usuarios\Models\User;

#[Fillable(['rescue_request_id', 'operator_id', 'previous_status', 'new_status'])]
class RescueStatusLog extends Model
{
    /** @use HasFactory<RescueStatusLogFactory> */
    use HasFactory;

    protected static function newFactory(): RescueStatusLogFactory
    {
        return RescueStatusLogFactory::new();
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'previous_status' => RescueRequestStatus::class,
            'new_status' => RescueRequestStatus::class,
        ];
    }

    /**
     * @return BelongsTo<RescueRequest, $this>
     */
    public function rescueRequest(): BelongsTo
    {
        return $this->belongsTo(RescueRequest::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function operator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'operator_id');
    }
}
