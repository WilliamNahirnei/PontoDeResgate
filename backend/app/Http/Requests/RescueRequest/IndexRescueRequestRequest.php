<?php

namespace App\Http\Requests\RescueRequest;

use App\Enums\RescueRequestStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class IndexRescueRequestRequest extends FormRequest
{
    /**
     * Columns accepted by the "sort_by" query parameter.
     *
     * @var array<int, string>
     */
    public const SORTABLE_COLUMNS = [
        'created_at',
        'total_people',
        'men_count',
        'women_count',
        'children_count',
        'elderly_count',
        'animals_count',
    ];

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
            'status' => ['nullable', Rule::enum(RescueRequestStatus::class)],
            'min_total_people' => ['nullable', 'integer', 'min:0'],
            'min_men_count' => ['nullable', 'integer', 'min:0'],
            'min_women_count' => ['nullable', 'integer', 'min:0'],
            'min_children_count' => ['nullable', 'integer', 'min:0'],
            'min_elderly_count' => ['nullable', 'integer', 'min:0'],
            'min_animals_count' => ['nullable', 'integer', 'min:0'],
            'sort_by' => ['nullable', Rule::in(self::SORTABLE_COLUMNS)],
            'sort_direction' => ['nullable', Rule::in(['asc', 'desc'])],
        ];
    }
}
