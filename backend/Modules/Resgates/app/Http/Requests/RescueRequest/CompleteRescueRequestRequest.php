<?php

namespace Modules\Resgates\Http\Requests\RescueRequest;

use Illuminate\Foundation\Http\FormRequest;

class CompleteRescueRequestRequest extends FormRequest
{
    /**
     * Authorization is enforced at the route level (auth:sanctum middleware).
     */
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
            'completion_note' => ['nullable', 'string', 'max:1000'],
        ];
    }
}
