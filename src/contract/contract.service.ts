import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Contract,
  ContractDocument,
  ContractStatus,
} from './schemas/contract.schema';
import { CreateContractDto } from './dto/create-contract.dto';
import { SignContractDto } from './dto/sign-contract.dto';
import { UserService } from '../user/user.service';
import { MissionsService } from '../missions/missions.service';
import { ConversationsService } from '../conversations/conversations.service';
import PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class ContractService {
  private readonly uploadsDir = path.join(process.cwd(), 'uploads', 'contracts');

  constructor(
    @InjectModel(Contract.name)
    private readonly contractModel: Model<ContractDocument>,
    private readonly userService: UserService,
    @Inject(forwardRef(() => MissionsService))
    private readonly missionsService: MissionsService,
    @Inject(forwardRef(() => ConversationsService))
    private readonly conversationsService: ConversationsService
  ) {
    // Ensure uploads directory exists
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
  }

  async create(
    createContractDto: CreateContractDto,
    recruiterId: string
  ): Promise<ContractDocument> {
    // Additional validation for contract fields (beyond DTO validation)
    // This ensures we catch any edge cases
    const missingFields: string[] = [];
    const fieldErrors: Record<string, string> = {};

    if (!createContractDto.title || createContractDto.title.trim() === '') {
      missingFields.push('title');
      fieldErrors.title = 'Title is required';
    }

    if (!createContractDto.recruiterSignature || createContractDto.recruiterSignature.trim() === '') {
      missingFields.push('recruiterSignature');
      fieldErrors.recruiterSignature = 'Recruiter signature is required';
    }

    if (!createContractDto.scope || createContractDto.scope.trim() === '') {
      missingFields.push('scope');
      fieldErrors.scope = 'Project Scope & Deliverables is required';
    }

    if (!createContractDto.budget || createContractDto.budget.trim() === '') {
      missingFields.push('budget');
      fieldErrors.budget = 'Compensation & Payment Terms is required';
    }

    if (!createContractDto.startDate) {
      missingFields.push('startDate');
      fieldErrors.startDate = 'Start date is required';
    }

    if (!createContractDto.endDate) {
      missingFields.push('endDate');
      fieldErrors.endDate = 'End date is required';
    }

    if (missingFields.length > 0) {
      throw new BadRequestException({
        message: 'Contract validation failed',
        missingFields,
        fieldErrors,
      });
    }

    // Verify mission exists and belongs to recruiter
    const mission = await this.missionsService.findOne(createContractDto.missionId);
    if (!mission) {
      throw new NotFoundException('Mission not found');
    }
    if (mission.recruiterId !== recruiterId) {
      throw new ForbiddenException('Mission does not belong to recruiter');
    }

    // Verify talent exists
    const talent = await this.userService.findById(createContractDto.talentId);
    if (!talent) {
      throw new NotFoundException('Talent not found');
    }

    // Get recruiter info
    const recruiter = await this.userService.findById(recruiterId);
    if (!recruiter) {
      throw new NotFoundException('Recruiter not found');
    }

    // Generate contract content
    const generatedContent = this.generateContractTemplate(
      createContractDto,
      recruiter,
      talent
    );

    // Create contract
    const contract = new this.contractModel({
      ...createContractDto,
      content: generatedContent,
      paymentDetails: createContractDto.budget, // Map budget to paymentDetails for backward compatibility/PDF
      recruiterId,
      status: ContractStatus.SENT_TO_TALENT,
    });

    const savedContract = await contract.save();

    // Generate PDF
    const pdfUrl = await this.generateContractPDF(savedContract, recruiter, talent);
    savedContract.pdfUrl = pdfUrl;
    await savedContract.save();

    // Find or create conversation
    const conversation = await this.conversationsService.findOrCreate(
      {
        missionId: createContractDto.missionId,
        talentId: createContractDto.talentId,
      },
      recruiterId,
      'recruiter'
    );

    // Send contract as message in conversation
    await this.conversationsService.sendContractMessage(
      (conversation._id as any).toString(),
      (savedContract._id as any).toString(),
      pdfUrl,
      recruiterId,
      false
    );

    return savedContract;
  }

  async signContract(
    contractId: string,
    talentId: string,
    signContractDto: SignContractDto
  ): Promise<ContractDocument> {
    const contract = await this.contractModel.findById(contractId).exec();
    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    if (contract.talentId !== talentId) {
      throw new ForbiddenException('Contract does not belong to talent');
    }

    // Validate contract has all required fields before signing
    const missingFields: string[] = [];
    const fieldErrors: Record<string, string> = {};

    if (!contract.title || contract.title.trim() === '') {
      missingFields.push('title');
      fieldErrors.title = 'Title is required';
    }

    if (!contract.content || contract.content.trim() === '') {
      missingFields.push('content');
      fieldErrors.content = 'Content is required';
    }

    if (!contract.recruiterSignature || contract.recruiterSignature.trim() === '') {
      missingFields.push('recruiterSignature');
      fieldErrors.recruiterSignature = 'Recruiter signature is required';
    }

    if (missingFields.length > 0) {
      throw new BadRequestException({
        message: 'Contract validation failed',
        missingFields,
        fieldErrors,
      });
    }

    let savedContract = contract;
    let signedPdfUrl = contract.signedPdfUrl;

    // If contract is not yet signed, sign it
    if (contract.status === ContractStatus.SENT_TO_TALENT) {
      // talentSignature is now validated by DTO, but we ensure it's not empty
      if (!signContractDto.talentSignature || signContractDto.talentSignature.trim() === '') {
        throw new BadRequestException({
          message: 'Contract validation failed',
          missingFields: ['talentSignature'],
          fieldErrors: {
            talentSignature: 'Talent signature is required to sign the contract',
          },
        });
      }
      contract.talentSignature = signContractDto.talentSignature;
      contract.status = ContractStatus.SIGNED_BY_BOTH;

      // Generate signed PDF
      const recruiter = await this.userService.findById(contract.recruiterId);
      const talent = await this.userService.findById(contract.talentId);
      signedPdfUrl = await this.generateSignedContractPDF(
        contract,
        recruiter,
        talent
      );
      contract.signedPdfUrl = signedPdfUrl;

      savedContract = await contract.save();

      // Update mission status to started
      await this.missionsService.updateStatus(
        contract.missionId,
        'started',
        contract.recruiterId
      );
    } else if (contract.status === ContractStatus.SIGNED_BY_BOTH) {
      // Contract is already signed, just ensure we have the signed PDF URL
      if (!signedPdfUrl) {
        // Regenerate if missing
        const recruiter = await this.userService.findById(contract.recruiterId);
        const talent = await this.userService.findById(contract.talentId);
        signedPdfUrl = await this.generateSignedContractPDF(
          contract,
          recruiter,
          talent
        );
        contract.signedPdfUrl = signedPdfUrl;
        savedContract = await contract.save();
      }
    } else {
      throw new BadRequestException('Contract cannot be signed in current status');
    }

    // Find conversation and send signed contract message
    // Pass recruiterId from the contract so the conversation service can find/create it
    const conversation = await this.conversationsService.findOrCreate(
      {
        missionId: contract.missionId,
        talentId: contract.talentId,
        recruiterId: contract.recruiterId, // Include recruiterId from contract
      },
      talentId,
      'talent'
    );

    // Determine the PDF URL to use
    const pdfToSend = signedPdfUrl || contract.signedPdfUrl || contract.pdfUrl || '';
    
    if (!pdfToSend) {
      throw new BadRequestException('Contract PDF is missing');
    }

    // Send contract message with appropriate text
    const isFullySigned = savedContract.status === ContractStatus.SIGNED_BY_BOTH;
    await this.conversationsService.sendContractMessage(
      (conversation._id as any).toString(),
      (savedContract._id as any).toString(),
      pdfToSend,
      talentId,
      isFullySigned
    );

    return savedContract;
  }

  async declineContract(
    contractId: string,
    talentId: string
  ): Promise<ContractDocument> {
    const contract = await this.contractModel.findById(contractId).exec();
    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    if (contract.talentId !== talentId) {
      throw new ForbiddenException('Contract does not belong to talent');
    }

    if (contract.status !== ContractStatus.SENT_TO_TALENT) {
      throw new BadRequestException('Contract cannot be declined in current status');
    }

    contract.status = ContractStatus.DECLINED_BY_TALENT;
    const savedContract = await contract.save();

    // Find conversation and send decline message
    const conversation = await this.conversationsService.findOrCreate(
      {
        missionId: contract.missionId,
        talentId: contract.talentId,
      },
      talentId,
      'talent'
    );

    await this.conversationsService.sendMessage(
      (conversation._id as any).toString(),
      { text: 'Contrat refusé' },
      talentId,
      'talent'
    );

    return savedContract;
  }

  async findOne(
    contractId: string,
    userId: string,
    userRole: string
  ): Promise<ContractDocument> {
    const contract = await this.contractModel.findById(contractId).exec();
    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    // Check permissions
    if (userRole === 'recruiter' && contract.recruiterId !== userId) {
      throw new ForbiddenException('Access denied');
    }
    if (userRole === 'talent' && contract.talentId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return contract;
  }

  async findByConversation(
    conversationId: string,
    userId: string,
    userRole: string
  ): Promise<ContractDocument[]> {
    // Verify conversation access
    const conversation = await this.conversationsService.findOne(
      conversationId,
      userId,
      userRole
    );

    const query: any = {
      missionId: conversation.missionId,
    };

    if (userRole === 'recruiter') {
      query.recruiterId = userId;
    } else {
      query.talentId = userId;
    }

    return this.contractModel.find(query).sort({ createdAt: -1 }).exec();
  }

  private async generateContractPDF(
    contract: ContractDocument,
    recruiter: any,
    talent: any
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const filename = `contract_${contract._id}_${Date.now()}.pdf`;
      const filepath = path.join(this.uploadsDir, filename);

      const doc = new PDFDocument({ margin: 50 });

      const stream = fs.createWriteStream(filepath);
      doc.pipe(stream);

      // Title
      doc.fontSize(20).text(contract.title, { align: 'center' });
      doc.moveDown(2);

      // Contract content
      doc.fontSize(11).text(contract.content, { align: 'justify', lineGap: 2 });
      doc.moveDown(2);

      // Payment details and Dates side by side
      const leftX = 50;
      const rightX = 300;
      const detailsStartY = doc.y;

      // Payment details (left)
      if (contract.paymentDetails) {
        doc.fontSize(13).text('Payment Details:', leftX, detailsStartY, { underline: true });
        const paymentY = doc.y + 5;
        doc.fontSize(11).text(contract.paymentDetails, leftX, paymentY);
      }

      // Dates (right)
      if (contract.startDate || contract.endDate) {
        doc.fontSize(13).text('Dates:', rightX, detailsStartY, { underline: true });
        let dateY = detailsStartY + 20;
        if (contract.startDate) {
          doc.fontSize(11).text(`Start: ${new Date(contract.startDate).toLocaleDateString('en-US')}`, rightX, dateY);
          dateY += 15;
        }
        if (contract.endDate) {
          doc.fontSize(11).text(`End: ${new Date(contract.endDate).toLocaleDateString('en-US')}`, rightX, dateY);
        }
      }
      
      // Move down after details section
      doc.y = detailsStartY + 80;
      doc.moveDown(2);

      // Signatures section - side by side
      doc.fontSize(13).text('Signatures:', { underline: true });
      doc.moveDown(1);

      const leftColumnX = 50;
      const rightColumnX = 300;
      const signatureStartY = doc.y;

      // Recruiter signature (left)
      doc.fontSize(11).text('Recruiter:', leftColumnX, signatureStartY);
      const sigImageY = signatureStartY + 18;
      
      if (contract.recruiterSignature) {
        try {
          const signatureBuffer = Buffer.from(
            contract.recruiterSignature.replace(/^data:image\/\w+;base64,/, ''),
            'base64'
          );
          doc.image(signatureBuffer, leftColumnX, sigImageY, {
            fit: [150, 60],
          });
        } catch (error) {
          console.error('Error rendering recruiter signature:', error);
          doc.fontSize(10).text('[Signature error]', leftColumnX, sigImageY);
        }
      }
      
      const nameY = sigImageY + 65;
      doc.fontSize(10).text(recruiter.fullName, leftColumnX, nameY);
      doc.fontSize(9).text(`Date: ${new Date().toLocaleDateString('en-US')}`, leftColumnX, nameY + 12);

      // Talent signature placeholder (right)
      doc.fontSize(11).text('Talent:', rightColumnX, signatureStartY);
      doc.fontSize(10).fillColor('#666').text('Signature pending', rightColumnX, sigImageY);
      doc.fillColor('black');
      doc.fontSize(10).text(talent.fullName, rightColumnX, nameY);
      doc.moveDown();

      doc.end();

      stream.on('finish', () => {
        const relativePath = `/uploads/contracts/${filename}`;
        resolve(relativePath);
      });

      stream.on('error', reject);
    });
  }

  private async generateSignedContractPDF(
    contract: ContractDocument,
    recruiter: any,
    talent: any
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const filename = `contract_signed_${contract._id}_${Date.now()}.pdf`;
      const filepath = path.join(this.uploadsDir, filename);

      const doc = new PDFDocument({ margin: 50 });

      const stream = fs.createWriteStream(filepath);
      doc.pipe(stream);

      // Title
      doc.fontSize(20).text(contract.title, { align: 'center' });
      doc.moveDown(2);

      // Contract content
      doc.fontSize(11).text(contract.content, { align: 'justify', lineGap: 2 });
      doc.moveDown(2);

      // Payment details and Dates side by side
      const leftX = 50;
      const rightX = 300;
      const detailsStartY = doc.y;

      // Payment details (left)
      if (contract.paymentDetails) {
        doc.fontSize(13).text('Payment Details:', leftX, detailsStartY, { underline: true });
        const paymentY = doc.y + 5;
        doc.fontSize(11).text(contract.paymentDetails, leftX, paymentY);
      }

      // Dates (right)
      if (contract.startDate || contract.endDate) {
        doc.fontSize(13).text('Dates:', rightX, detailsStartY, { underline: true });
        let dateY = detailsStartY + 20;
        if (contract.startDate) {
          doc.fontSize(11).text(`Start: ${new Date(contract.startDate).toLocaleDateString('en-US')}`, rightX, dateY);
          dateY += 15;
        }
        if (contract.endDate) {
          doc.fontSize(11).text(`End: ${new Date(contract.endDate).toLocaleDateString('en-US')}`, rightX, dateY);
        }
      }
      
      // Move down after details section
      doc.y = detailsStartY + 80;
      doc.moveDown(2);

      // Signatures section - side by side
      doc.fontSize(13).text('Signatures:', { underline: true });
      doc.moveDown(1);

      const leftColumnX = 50;
      const rightColumnX = 300;
      const signatureStartY = doc.y;

      // Recruiter signature (left)
      doc.fontSize(11).text('Recruiter:', leftColumnX, signatureStartY);
      const sigImageY = signatureStartY + 18;
      
      if (contract.recruiterSignature) {
        try {
          const signatureBuffer = Buffer.from(
            contract.recruiterSignature.replace(/^data:image\/\w+;base64,/, ''),
            'base64'
          );
          doc.image(signatureBuffer, leftColumnX, sigImageY, {
            fit: [150, 60],
          });
        } catch (error) {
          console.error('Error rendering recruiter signature:', error);
          doc.fontSize(10).text('[Signature error]', leftColumnX, sigImageY);
        }
      }
      
      const nameY = sigImageY + 65;
      doc.fontSize(10).text(recruiter.fullName, leftColumnX, nameY);
      doc.fontSize(9).text(`Date: ${new Date(contract.createdAt).toLocaleDateString('en-US')}`, leftColumnX, nameY + 12);

      // Talent signature (right)
      doc.fontSize(11).text('Talent:', rightColumnX, signatureStartY);
      
      if (contract.talentSignature) {
        try {
          const signatureBuffer = Buffer.from(
            contract.talentSignature.replace(/^data:image\/\w+;base64,/, ''),
            'base64'
          );
          doc.image(signatureBuffer, rightColumnX, sigImageY, {
            fit: [150, 60],
          });
        } catch (error) {
          console.error('Error rendering talent signature:', error);
          doc.fontSize(10).text('[Signature error]', rightColumnX, sigImageY);
        }
      } else {
        doc.fontSize(10).fillColor('#666').text('Signature pending', rightColumnX, sigImageY);
        doc.fillColor('black');
      }
      
      doc.fontSize(10).text(talent.fullName, rightColumnX, nameY);
      doc.fontSize(9).text(`Date: ${new Date().toLocaleDateString('en-US')}`, rightColumnX, nameY + 12);
      doc.moveDown();

      doc.end();

      stream.on('finish', () => {
        const relativePath = `/uploads/contracts/${filename}`;
        resolve(relativePath);
      });

      stream.on('error', reject);
    });
  }

  private generateContractTemplate(
    dto: CreateContractDto,
    recruiter: any,
    talent: any
  ): string {
    const startDate = dto.startDate ? new Date(dto.startDate).toLocaleDateString('en-US') : 'N/A';
    const endDate = dto.endDate ? new Date(dto.endDate).toLocaleDateString('en-US') : 'N/A';

    return `1. Services to be Performed
The Client engages the Contractor to perform services as an independent contractor. The specific details, scope, and deliverables for each assignment will be defined in separate, written Statements of Work (SOWs), which will be attached as Exhibit A, Exhibit B, etc., and incorporated into this main Agreement. The nature of services can range from IT development to video editing, as detailed in the relevant SOW.

2. Key Terms to be Assigned and Agreed Upon
For each specific project (SOW), the following three key points must be explicitly defined and agreed to in writing by both the Client and the Contractor:
* Project Scope & Deliverables: ${dto.scope}
* Schedule & Deadlines: The project starts on ${startDate} and is expected to be completed by ${endDate}.
* Compensation & Payment Terms: ${dto.budget}

3. Independent Contractor Status
The Contractor is an independent contractor and not an employee or agent of the Client. The Contractor controls the method of performing services and is responsible for their own taxes and insurance.

4. Compensation and Expenses
Payment is based on the applicable SOW. The Contractor is responsible for their expenses unless the SOW specifies reimbursable ones.

5. Confidentiality 
The Contractor agrees not to disclose or use the Client's confidential information except for service performance.

6. Ownership of Work Product
All work created for the Client under this Agreement becomes the Client's sole property upon full payment.

7. Term and Termination
The Agreement is effective upon signing and lasts until SOWs are completed, unless terminated earlier. Either party can terminate with written notice or immediately for a material breach.

8. Entire Agreement
This document and SOWs form the complete agreement, superseding prior discussions. Modifications require a written amendment signed by both parties.
`;
  }
}

