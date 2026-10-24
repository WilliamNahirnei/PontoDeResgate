<?php

namespace Modules\Resgates\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Modules\Resgates\Enums\RescueRequestStatus;
use Modules\Usuarios\Http\Resources\UserResource;

class RescueStatusLogResource extends JsonResource
{
    /**
     * Transform the status-change audit log entry into its public JSON representation.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'rescue_request' => [
                'id' => $this->rescueRequest->id,
                'requester_name' => $this->rescueRequest->requester_name,
                'reference_point' => $this->rescueRequest->reference_point,
            ],
            'operator' => new UserResource($this->operator),
            'previous_status' => $this->previous_status->value,
            'new_status' => $this->new_status->value,
            'observation' => $this->observation(),
            'created_at' => $this->created_at,
        ];
    }

    /**
     * The text recorded with the status change: the cancellation reason on a
     * cancellation, the completion note on a completion, nothing otherwise.
     */
    private function observation(): ?string
    {
        return match ($this->new_status) {
            RescueRequestStatus::Cancelado => $this->rescueRequest->cancellation_reason,
            RescueRequestStatus::Concluido => $this->rescueRequest->completion_note,
            default => null,
        };
    }
}
