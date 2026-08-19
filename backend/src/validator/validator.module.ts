import { Module } from '@nestjs/common';
import { ProposalValidatorService } from './proposal-validator.service';

@Module({
  providers: [ProposalValidatorService],
  exports: [ProposalValidatorService],
})
export class ValidatorModule {}
