<?php

namespace Modules\Resgates\Tests\Unit\Http\Requests\RescueRequest;

use Illuminate\Support\Facades\Validator;
use Modules\Resgates\Http\Requests\RescueRequest\StoreRescueRequestRequest;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\TestDox;
use Tests\TestCase;

class StoreRescueRequestRequestTest extends TestCase
{
    #[TestDox('authorize() deve permitir qualquer requisição — endpoint público.')]
    public function test_authorize_allows_any_request(): void
    {
        $this->assertTrue((new StoreRescueRequestRequest)->authorize());
    }

    #[TestDox('A validação deve exigir latitude quando a longitude é informada.')]
    public function test_latitude_is_required(): void
    {
        $validator = Validator::make([
            'longitude' => -46.63,
        ], (new StoreRescueRequestRequest)->rules());

        $this->assertTrue($validator->fails());
        $errors = $validator->errors()->toArray();
        $this->assertArrayHasKey('latitude', $errors);
        $this->assertArrayNotHasKey('longitude', $errors);
    }

    #[TestDox('A validação deve exigir longitude quando a latitude é informada.')]
    public function test_longitude_is_required(): void
    {
        $validator = Validator::make([
            'latitude' => -23.55,
        ], (new StoreRescueRequestRequest)->rules());

        $this->assertTrue($validator->fails());
        $errors = $validator->errors()->toArray();
        $this->assertArrayHasKey('longitude', $errors);
        $this->assertArrayNotHasKey('latitude', $errors);
    }

    #[TestDox('A validação deve rejeitar uma latitude fora do intervalo -90 a 90.')]
    public function test_latitude_must_be_between_minus_90_and_90(): void
    {
        $validator = Validator::make([
            'latitude' => 200,
            'longitude' => 0,
        ], (new StoreRescueRequestRequest)->rules());

        $this->assertTrue($validator->fails());
        $this->assertArrayHasKey('latitude', $validator->errors()->toArray());
    }

    #[TestDox('A validação deve aceitar uma latitude dentro do intervalo -90 a 90.')]
    public function test_latitude_accepts_a_value_within_range(): void
    {
        $validator = Validator::make([
            'latitude' => -23.55,
            'longitude' => 0,
        ], (new StoreRescueRequestRequest)->rules());

        $this->assertArrayNotHasKey('latitude', $validator->errors()->toArray());
    }

    #[TestDox('A validação deve rejeitar uma longitude fora do intervalo -180 a 180.')]
    public function test_longitude_must_be_between_minus_180_and_180(): void
    {
        $validator = Validator::make([
            'latitude' => 0,
            'longitude' => 200,
        ], (new StoreRescueRequestRequest)->rules());

        $this->assertTrue($validator->fails());
        $this->assertArrayHasKey('longitude', $validator->errors()->toArray());
    }

    #[TestDox('A validação deve aceitar uma longitude dentro do intervalo -180 a 180.')]
    public function test_longitude_accepts_a_value_within_range(): void
    {
        $validator = Validator::make([
            'latitude' => 0,
            'longitude' => -46.63,
        ], (new StoreRescueRequestRequest)->rules());

        $this->assertArrayNotHasKey('longitude', $validator->errors()->toArray());
    }

    #[TestDox('A validação deve rejeitar uma quantidade negativa em qualquer campo de contagem.')]
    public function test_quantity_fields_must_not_be_negative(): void
    {
        $validator = Validator::make([
            'latitude' => 0,
            'longitude' => 0,
            'total_people' => -1,
        ], (new StoreRescueRequestRequest)->rules());

        $this->assertTrue($validator->fails());
        $this->assertArrayHasKey('total_people', $validator->errors()->toArray());
    }

    /**
     * @return array<string, array{string}>
     */
    public static function quantityFields(): array
    {
        return [
            'total de pessoas' => ['total_people'],
            'homens' => ['men_count'],
            'mulheres' => ['women_count'],
            'crianças' => ['children_count'],
            'idosos' => ['elderly_count'],
            'animais' => ['animals_count'],
        ];
    }

    #[DataProvider('quantityFields')]
    #[TestDox('A validação deve rejeitar uma quantidade acima de 999 em qualquer campo de contagem.')]
    public function test_quantity_fields_must_not_exceed_999(string $field): void
    {
        $validator = Validator::make([
            'latitude' => 0,
            'longitude' => 0,
            $field => 1000,
        ], (new StoreRescueRequestRequest)->rules());

        $this->assertTrue($validator->fails());
        $this->assertArrayHasKey($field, $validator->errors()->toArray());
    }

    #[DataProvider('quantityFields')]
    #[TestDox('A validação deve aceitar 999 em qualquer campo de contagem.')]
    public function test_quantity_fields_accept_999(string $field): void
    {
        $validator = Validator::make([
            'latitude' => 0,
            'longitude' => 0,
            $field => 999,
        ], (new StoreRescueRequestRequest)->rules());

        $this->assertFalse($validator->fails());
    }

    #[TestDox('A validação deve rejeitar uma quantidade maior que a coluna do banco comporta, em vez de deixar o envio falhar ao gravar.')]
    public function test_quantity_larger_than_the_database_column_is_rejected(): void
    {
        $validator = Validator::make([
            'latitude' => 0,
            'longitude' => 0,
            'total_people' => 4294967296,
        ], (new StoreRescueRequestRequest)->rules());

        $this->assertTrue($validator->fails());
        $this->assertArrayHasKey('total_people', $validator->errors()->toArray());
    }

    #[TestDox('A validação deve rejeitar uma quantidade com casas decimais.')]
    public function test_quantity_fields_must_be_integers(): void
    {
        $validator = Validator::make([
            'latitude' => 0,
            'longitude' => 0,
            'children_count' => 1.5,
        ], (new StoreRescueRequestRequest)->rules());

        $this->assertTrue($validator->fails());
        $this->assertArrayHasKey('children_count', $validator->errors()->toArray());
    }

    #[TestDox('A validação deve aceitar um nome com 255 caracteres e rejeitar um com 256.')]
    public function test_requester_name_accepts_up_to_255_characters(): void
    {
        $rules = (new StoreRescueRequestRequest)->rules();

        $atLimit = Validator::make(['latitude' => 0, 'longitude' => 0, 'requester_name' => str_repeat('n', 255)], $rules);
        $overLimit = Validator::make(['latitude' => 0, 'longitude' => 0, 'requester_name' => str_repeat('n', 256)], $rules);

        $this->assertFalse($atLimit->fails());
        $this->assertTrue($overLimit->fails());
        $this->assertArrayHasKey('requester_name', $overLimit->errors()->toArray());
    }

    #[TestDox('A validação deve aceitar um ponto de referência com 1000 caracteres e rejeitar um com 1001.')]
    public function test_reference_point_accepts_up_to_1000_characters(): void
    {
        $rules = (new StoreRescueRequestRequest)->rules();

        $atLimit = Validator::make(['latitude' => 0, 'longitude' => 0, 'reference_point' => str_repeat('r', 1000)], $rules);
        $overLimit = Validator::make(['latitude' => 0, 'longitude' => 0, 'reference_point' => str_repeat('r', 1001)], $rules);

        $this->assertFalse($atLimit->fails());
        $this->assertTrue($overLimit->fails());
        $this->assertArrayHasKey('reference_point', $overLimit->errors()->toArray());
    }

    #[TestDox('A validação deve passar apenas com latitude e longitude, os demais campos são opcionais.')]
    public function test_valid_payload_with_only_required_fields_passes_validation(): void
    {
        $validator = Validator::make([
            'latitude' => -23.55,
            'longitude' => -46.63,
        ], (new StoreRescueRequestRequest)->rules());

        $this->assertFalse($validator->fails());
    }

    #[TestDox('A validação deve passar quando todos os campos são informados corretamente.')]
    public function test_valid_payload_with_all_fields_passes_validation(): void
    {
        $validator = Validator::make([
            'latitude' => -23.55,
            'longitude' => -46.63,
            'requester_name' => 'Maria da Silva',
            'total_people' => 4,
            'men_count' => 1,
            'women_count' => 1,
            'children_count' => 2,
            'elderly_count' => 0,
            'animals_count' => 1,
            'reference_point' => 'Próximo ao mercado central',
        ], (new StoreRescueRequestRequest)->rules());

        $this->assertFalse($validator->fails());
    }
}
