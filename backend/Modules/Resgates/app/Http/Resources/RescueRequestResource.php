<?php

namespace Modules\Resgates\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Modules\Usuarios\Http\Resources\UserResource;

class RescueRequestResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'latitude' => (float) $this->latitude,
            'longitude' => (float) $this->longitude,
            'requester_name' => $this->requester_name,
            'total_people' => $this->total_people,
            'men_count' => $this->men_count,
            'women_count' => $this->women_count,
            'children_count' => $this->children_count,
            'elderly_count' => $this->elderly_count,
            'animals_count' => $this->animals_count,
            'reference_point' => $this->reference_point,
            'status' => $this->status->value,
            'cancellation_reason' => $this->cancellation_reason,
            'operator' => $this->whenLoaded('operator', fn () => $this->operator ? new UserResource($this->operator) : null),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
