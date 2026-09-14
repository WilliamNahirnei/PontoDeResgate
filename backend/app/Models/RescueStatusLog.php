<?php

namespace App\Models;

use App\Enums\RescueRequestStatus;
use Database\Factories\RescueStatusLogFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['rescue_request_id', 'operator_id', 'previous_status', 'new_status'])]
class RescueStatusLog extends Model
{
    /** @use HasFactory<RescueStatusLogFactory> */
    use HasFactory;

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
