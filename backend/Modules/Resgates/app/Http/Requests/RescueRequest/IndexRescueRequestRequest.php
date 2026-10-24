<?php

namespace Modules\Resgates\Http\Requests\RescueRequest;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Modules\Resgates\Enums\RescueRequestStatus;

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

    /**
     * Page sizes accepted by the "per_page" query parameter.
     *
     * @var array<int, int>
     */
    public const PER_PAGE_OPTIONS = [5, 10, 20, 30, 50, 100];

    /**
     * Page size used when "per_page" is not informed.
     */
    public const DEFAULT_PER_PAGE = 50;

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
            'status' => ['nullable', Rule::enum(RescueRequestStatus::class)],
            'min_total_people' => ['nullable', 'integer', 'min:0', 'max:999'],
            'min_men_count' => ['nullable', 'integer', 'min:0', 'max:999'],
            'min_women_count' => ['nullable', 'integer', 'min:0', 'max:999'],
            'min_children_count' => ['nullable', 'integer', 'min:0', 'max:999'],
            'min_elderly_count' => ['nullable', 'integer', 'min:0', 'max:999'],
            'min_animals_count' => ['nullable', 'integer', 'min:0', 'max:999'],
            'sort_by' => ['nullable', Rule::in(self::SORTABLE_COLUMNS)],
            'sort_direction' => ['nullable', Rule::in(['asc', 'desc'])],
            'per_page' => ['nullable', 'integer', Rule::in(self::PER_PAGE_OPTIONS)],
            'page' => ['nullable', 'integer', 'min:1'],
        ];
    }
}
