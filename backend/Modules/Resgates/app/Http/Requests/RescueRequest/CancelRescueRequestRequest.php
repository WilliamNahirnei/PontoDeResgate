<?php

namespace Modules\Resgates\Http\Requests\RescueRequest;

use Illuminate\Foundation\Http\FormRequest;

class CancelRescueRequestRequest extends FormRequest
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
            'cancellation_reason' => ['required', 'string', 'max:1000'],
        ];
    }
}
