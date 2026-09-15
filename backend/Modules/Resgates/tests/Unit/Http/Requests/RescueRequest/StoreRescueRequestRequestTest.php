<?php

namespace Modules\Resgates\Tests\Unit\Http\Requests\RescueRequest;

use Illuminate\Support\Facades\Validator;
use Modules\Resgates\Http\Requests\RescueRequest\StoreRescueRequestRequest;
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
