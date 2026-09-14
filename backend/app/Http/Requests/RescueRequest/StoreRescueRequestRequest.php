<?php

namespace App\Http\Requests\RescueRequest;

use Illuminate\Foundation\Http\FormRequest;

class StoreRescueRequestRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'latitude' => ['required', 'numeric', 'between:-90,90'],
            'longitude' => ['required', 'numeric', 'between:-180,180'],
            'requester_name' => ['nullable', 'string', 'max:255'],
            'total_people' => ['nullable', 'integer', 'min:0'],
            'men_count' => ['nullable', 'integer', 'min:0'],
            'women_count' => ['nullable', 'integer', 'min:0'],
            'children_count' => ['nullable', 'integer', 'min:0'],
            'elderly_count' => ['nullable', 'integer', 'min:0'],
            'animals_count' => ['nullable', 'integer', 'min:0'],
            'reference_point' => ['nullable', 'string', 'max:1000'],
        ];
    }
}
