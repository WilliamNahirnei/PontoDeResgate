<?php

namespace Modules\Resgates\Repositories;

use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Modules\Resgates\Models\RescueRequest;
use Modules\Resgates\Repositories\Contracts\RescueRequestRepositoryInterface;

class RescueRequestRepository implements RescueRequestRepositoryInterface
{
    /**
     * Quantity columns that accept a "min_<column>" filter, keyed by the filter key.
     *
     * @var array<string, string>
     */
    private const QUANTITY_FILTERS = [
        'min_total_people' => 'total_people',
        'min_men_count' => 'men_count',
        'min_women_count' => 'women_count',
        'min_children_count' => 'children_count',
        'min_elderly_count' => 'elderly_count',
        'min_animals_count' => 'animals_count',
    ];

    /**
     * Persist a new rescue request with the given attributes.
     *
     * @param  array<string, mixed>  $attributes
     */
    public function create(array $attributes): RescueRequest
    {
        return RescueRequest::create($attributes);
    }

    /**
     * Paginate rescue requests matching the given filters, sorted by the given column/direction.
     *
     * @param  array<string, mixed>  $filters
     * @return LengthAwarePaginator<int, RescueRequest>
     */
    public function paginateWithFilters(array $filters, string $sortBy, string $sortDirection, int $perPage): LengthAwarePaginator
    {
        $query = RescueRequest::query()
            ->with('operator')
            ->when(
                $this->filled($filters, 'status'),
                fn ($query) => $query->where('status', $filters['status'])
            );

        foreach (self::QUANTITY_FILTERS as $param => $column) {
            $query->when(
                $this->filled($filters, $param),
                // Só considera pedidos com a informação preenchida: um pedido sem
                // essa quantidade informada não pode "satisfazer" um filtro mínimo.
                fn ($query) => $query->whereNotNull($column)->where($column, '>=', $filters[$param])
            );
        }

        return $query
            // Coloca os pedidos sem a informação preenchida sempre por último,
            // independente da direção escolhida para a ordenação.
            ->orderByRaw("{$sortBy} IS NULL")
            ->orderBy($sortBy, $sortDirection)
            // Desempate pelo id: sem ele, pedidos com o mesmo valor de ordenação
            // podem repetir ou sumir na troca de página.
            ->orderBy('id', $sortDirection)
            ->paginate($perPage);
    }

    /**
     * Update a rescue request's attributes (typically its status and related fields).
     *
     * @param  array<string, mixed>  $attributes
     */
    public function findForUpdate(RescueRequest $rescueRequest): RescueRequest
    {
        return RescueRequest::query()->lockForUpdate()->findOrFail($rescueRequest->id);
    }

    public function updateStatus(RescueRequest $rescueRequest, array $attributes): RescueRequest
    {
        $rescueRequest->update($attributes);

        return $rescueRequest;
    }

    /**
     * Reload the rescue request from the database with its operator relation eager-loaded.
     */
    public function freshWithOperator(RescueRequest $rescueRequest): RescueRequest
    {
        return $rescueRequest->fresh('operator');
    }

    /**
     * Whether the given filter key is present with a non-null, non-empty-string value.
     *
     * Mirrors {@see Request::filled()}: unlike PHP's empty(), the
     * numeric value 0 counts as filled (e.g. "min_total_people=0" is a valid filter).
     *
     * @param  array<string, mixed>  $filters
     */
    private function filled(array $filters, string $key): bool
    {
        return array_key_exists($key, $filters) && $filters[$key] !== null && $filters[$key] !== '';
    }
}
