<?php

namespace Modules\Resgates\Tests\Unit\Http\Requests\RescueRequest;

use Illuminate\Support\Facades\Validator;
use Modules\Resgates\Http\Requests\RescueRequest\IndexRescueRequestRequest;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\TestDox;
use Tests\TestCase;

class IndexRescueRequestRequestTest extends TestCase
{
    #[TestDox('authorize() deve permitir qualquer requisição — a autorização é feita no middleware da rota.')]
    public function test_authorize_allows_any_request(): void
    {
        $this->assertTrue((new IndexRescueRequestRequest)->authorize());
    }

    #[TestDox('A validação deve passar sem nenhum filtro informado — todos os campos são opcionais.')]
    public function test_empty_payload_passes_validation(): void
    {
        $validator = Validator::make([], (new IndexRescueRequestRequest)->rules());

        $this->assertFalse($validator->fails());
    }

    #[TestDox('A validação deve rejeitar um status que não existe no enum de status do pedido.')]
    public function test_status_must_be_a_valid_enum_value(): void
    {
        $validator = Validator::make(
            ['status' => 'status_inexistente'],
            (new IndexRescueRequestRequest)->rules()
        );

        $this->assertTrue($validator->fails());
        $this->assertArrayHasKey('status', $validator->errors()->toArray());
    }

    #[TestDox('A validação deve aceitar um status válido do enum de status do pedido.')]
    public function test_status_accepts_a_valid_enum_value(): void
    {
        $validator = Validator::make(
            ['status' => 'pendente'],
            (new IndexRescueRequestRequest)->rules()
        );

        $this->assertFalse($validator->fails());
    }

    #[TestDox('A validação deve rejeitar uma coluna de ordenação fora da lista de colunas permitidas.')]
    public function test_sort_by_must_be_one_of_the_sortable_columns(): void
    {
        $validator = Validator::make(
            ['sort_by' => 'password'],
            (new IndexRescueRequestRequest)->rules()
        );

        $this->assertTrue($validator->fails());
        $this->assertArrayHasKey('sort_by', $validator->errors()->toArray());
    }

    #[TestDox('A validação deve aceitar uma coluna de ordenação permitida.')]
    public function test_sort_by_accepts_a_valid_sortable_column(): void
    {
        $validator = Validator::make(
            ['sort_by' => 'total_people'],
            (new IndexRescueRequestRequest)->rules()
        );

        $this->assertFalse($validator->fails());
    }

    #[TestDox('A validação deve rejeitar uma direção de ordenação diferente de asc/desc.')]
    public function test_sort_direction_must_be_asc_or_desc(): void
    {
        $validator = Validator::make(
            ['sort_direction' => 'crescente'],
            (new IndexRescueRequestRequest)->rules()
        );

        $this->assertTrue($validator->fails());
        $this->assertArrayHasKey('sort_direction', $validator->errors()->toArray());
    }

    #[TestDox('A validação deve aceitar "asc" e "desc" como direção de ordenação.')]
    public function test_sort_direction_accepts_asc_or_desc(): void
    {
        $ascending = Validator::make(
            ['sort_direction' => 'asc'],
            (new IndexRescueRequestRequest)->rules()
        );
        $descending = Validator::make(
            ['sort_direction' => 'desc'],
            (new IndexRescueRequestRequest)->rules()
        );

        $this->assertArrayNotHasKey('sort_direction', $ascending->errors()->toArray());
        $this->assertArrayNotHasKey('sort_direction', $descending->errors()->toArray());
    }

    /**
     * @return array<string, array{string}>
     */
    public static function minQuantityFields(): array
    {
        return [
            'total de pessoas' => ['min_total_people'],
            'homens' => ['min_men_count'],
            'mulheres' => ['min_women_count'],
            'crianças' => ['min_children_count'],
            'idosos' => ['min_elderly_count'],
            'animais' => ['min_animals_count'],
        ];
    }

    #[DataProvider('minQuantityFields')]
    #[TestDox('A validação deve rejeitar um filtro de quantidade mínima negativo.')]
    public function test_min_quantity_filters_must_not_be_negative(string $field): void
    {
        $validator = Validator::make([$field => -1], (new IndexRescueRequestRequest)->rules());

        $this->assertTrue($validator->fails());
        $this->assertArrayHasKey($field, $validator->errors()->toArray());
    }

    #[DataProvider('minQuantityFields')]
    #[TestDox('A validação deve aceitar 0 como filtro de quantidade mínima.')]
    public function test_min_quantity_filters_accept_zero(string $field): void
    {
        $validator = Validator::make([$field => 0], (new IndexRescueRequestRequest)->rules());

        $this->assertFalse($validator->fails());
    }

    #[DataProvider('minQuantityFields')]
    #[TestDox('A validação deve aceitar 999 como filtro de quantidade mínima.')]
    public function test_min_quantity_filters_accept_999(string $field): void
    {
        $validator = Validator::make([$field => 999], (new IndexRescueRequestRequest)->rules());

        $this->assertFalse($validator->fails());
    }

    #[DataProvider('minQuantityFields')]
    #[TestDox('A validação deve rejeitar um filtro de quantidade mínima acima de 999.')]
    public function test_min_quantity_filters_must_not_exceed_999(string $field): void
    {
        $validator = Validator::make([$field => 1000], (new IndexRescueRequestRequest)->rules());

        $this->assertTrue($validator->fails());
        $this->assertArrayHasKey($field, $validator->errors()->toArray());
    }

    #[DataProvider('minQuantityFields')]
    #[TestDox('A validação deve rejeitar um filtro de quantidade mínima com casas decimais.')]
    public function test_min_quantity_filters_must_be_integers(string $field): void
    {
        $validator = Validator::make([$field => 1.5], (new IndexRescueRequestRequest)->rules());

        $this->assertTrue($validator->fails());
        $this->assertArrayHasKey($field, $validator->errors()->toArray());
    }
}
