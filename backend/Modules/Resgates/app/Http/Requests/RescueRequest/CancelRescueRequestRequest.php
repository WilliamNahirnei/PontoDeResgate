<?php

namespace Modules\Resgates\Http\Requests\RescueRequest;

use Illuminate\Foundation\Http\FormRequest;

class CancelRescueRequestRequest extends FormRequest
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
            'cancellation_reason' => ['required', 'string', 'max:1000'],
        ];
    }
}
