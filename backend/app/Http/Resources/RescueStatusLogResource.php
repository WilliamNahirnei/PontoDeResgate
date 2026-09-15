<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class RescueStatusLogResource extends JsonResource
{
    /**
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
            'created_at' => $this->created_at,
        ];
    }
}
