import { EVM as EVMUtils } from "./evm";
import { AstDefinition } from "./ast";
import { StoragePointer } from "truffle-decoder/lib/types/pointer";
import cloneDeep from "lodash.clonedeep";
import BN from "bn.js";

export namespace Definition {

  export type StorageLength = {bytes: number} | {words: BN};

  export function isWordsLength(size: StorageLength): size is {words: BN} {
    return (<{words: BN}>size).words !== undefined;
  }

  //temporary HACK, to be removed in next PR (or soon, anyway)
  export function storageLengthToBytes(size: StorageLength): number {
    if(isWordsLength(size)) {
      return size.words.muln(EVMUtils.WORD_SIZE).toNumber(); //HACK
    }
    else {
      return size.bytes;
    }
  }

  export function typeIdentifier(definition: AstDefinition): string {
    return definition.typeDescriptions.typeIdentifier;
  }

  /**
   * returns basic type class for a variable definition node
   * e.g.:
   *  `t_uint256` becomes `uint`
   *  `t_struct$_Thing_$20_memory_ptr` becomes `struct`
   */
  export function typeClass(definition: AstDefinition): string {
    return typeIdentifier(definition).match(/t_([^$_0-9]+)/)[1];
  }

  /**
   * For function types; returns internal or external
   * (not for use on other types! will cause an error!)
   * should only return "internal" or "external"
   */
  export function visibility(definition: AstDefinition): string {
    return definition.visibility || definition.typeName.visibility;
  }


  /**
   * e.g. uint48 -> 6
   * @return size in bytes for explicit type size, or `null` if not stated
   */
  export function specifiedSize(definition: AstDefinition): number {
    let specified = typeIdentifier(definition).match(/t_[a-z]+([0-9]+)/);

    if (!specified) {
      return null;
    }

    let num = parseInt(specified[1]);

    switch (typeClass(definition)) {
      case "int":
      case "uint":
      case "fixed":
      case "ufixed":
        return num / 8;

      case "bytes":
        return num;

      default:
        // debug("Unknown type for size specification: %s", typeIdentifier(definition));
    }
  }

  //NOTE: This wrapper function is for use by the decoder ONLY, after allocation is done.
  //The allocator should (and does) instead use a direct call to storageSizeAndAllocate,
  //not to the wrapper, because it may need the allocations returned.
  export function storageSize(definition: AstDefinition, referenceDeclarations?: AstReferences, allocations?: StorageAllocations): StorageLength {
    return storageSizeAndAllocate(definition, referenceDeclarations, allocations)[0];
  }

  export function isArray(definition: AstDefinition): boolean {
    return typeIdentifier(definition).match(/^t_array/) != null;
  }

  export function isDynamicArray(definition: AstDefinition): boolean {
    return isArray(definition) && (
      (definition.typeName && definition.typeName.length == null) ||
        definition.length == null
    );
  }

  export function isStruct(definition: AstDefinition): boolean {
    return typeIdentifier(definition).match(/^t_struct/) != null;
  }

  export function isMapping(definition: AstDefinition): boolean {
    return typeIdentifier(definition).match(/^t_mapping/) != null;
  }

  export function isEnum(definition: AstDefinition): boolean {
    return typeIdentifier(definition).match(/^t_enum/) != null;
  }

  export function isContract(definition: AstDefinition): boolean {
    return typeIdentifier(definition).match(/^t_contract/) != null;
  }

  export function isReference(definition: AstDefinition): boolean {
    return typeIdentifier(definition).match(/_(memory|storage)(_ptr)?$/) != null;
  }

  export function isContractType(definition: AstDefinition): boolean {
    // checks whether the given node is a contract *type*, rather than whether
    // it's a contract
    return typeIdentifier(definition).match(/^t_type\$_t_contract/) != null;
  }

  export function referenceType(definition: AstDefinition): string {
    return typeIdentifier(definition).match(/_([^_]+)(_ptr)?$/)[1];
  }

  export function baseDefinition(definition: AstDefinition): AstDefinition {
    if (definition.typeName && typeof definition.typeName.baseType === "object") {
      return definition.typeName.baseType;
    }

    let baseIdentifier = typeIdentifier(definition)
      // first dollar sign     last dollar sign
      //   `---------.       ,---'
      .match(/^[^$]+\$_(.+)_\$[^$]+$/)[1]
      //              `----' greedy match

    // HACK - internal types for memory or storage also seem to be pointers
    if (baseIdentifier.match(/_(memory|storage)$/) != null) {
      baseIdentifier = `${baseIdentifier}_ptr`;
    }

    // another HACK - we get away with it becausewe're only using that one property
    let result: AstDefinition = cloneDeep(definition);
    result.typeDescriptions.typeIdentifier = baseIdentifier;
    return result;
  }
}
